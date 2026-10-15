package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"
)

const (
	maxMenuName        = 100
	maxMenuDescription = 500
	maxMenuDays        = 28
)

var (
	ErrMenuNameExists = errors.New("ein menü mit diesem namen gibt es schon")
	ErrEmptyMenu      = errors.New("der zeitraum enthält keine einträge")
	ErrMenuDayLimit   = errors.New("ein menü muss zwischen 1 und 28 tage haben")
)

type MenuSummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Days        int    `json:"days"`
	RecipeCount int    `json:"recipeCount"`
}

type Menu struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description,omitempty"`
	Days        int                 `json:"days"`
	CreatedAt   string              `json:"createdAt"`
	Entries     map[int][]MenuEntry `json:"entries"`
}

type MenuEntry struct {
	ID         string        `json:"id"`
	Day        int           `json:"day"`
	Meal       string        `json:"meal"`
	Position   int           `json:"position"`
	Kind       string        `json:"kind"`
	RecipeID   string        `json:"recipeId,omitempty"`
	Servings   *int          `json:"servings,omitempty"`
	Text       string        `json:"text,omitempty"`
	LeftoverOf *MenuEntryRef `json:"leftoverOf,omitempty"`
}

type MenuEntryRef struct {
	ID  string `json:"id"`
	Day int    `json:"day"`
}

type MenuInput struct {
	Name        string
	Description string
	Days        int
}

type MenuEntryInput struct {
	Day        int
	Meal       string
	Kind       string
	RecipeID   string
	Servings   *int
	Text       string
	LeftoverOf string
}

type MenuEntryPatch struct {
	Day         *int
	Meal        *string
	SetServings bool
	Servings    *int
	Text        *string
}

const menuEntryColumns = `e.id, e.day, e.meal, e.position, e.kind, e.recipe_id, e.servings, e.text, e.leftover_of, o.day`
const menuEntryFrom = ` FROM menu_entries e LEFT JOIN menu_entries o ON o.id = e.leftover_of`

func (db *DB) ListMenus(ctx context.Context) ([]MenuSummary, error) {
	rows, err := db.sql.QueryContext(ctx, `SELECT m.id, m.name, m.description, m.days,
		COUNT(CASE WHEN e.kind = 'recipe' THEN 1 END)
		FROM menus m LEFT JOIN menu_entries e ON e.menu_id = m.id
		GROUP BY m.id ORDER BY m.name_key, m.name`)
	if err != nil {
		return nil, fmt.Errorf("menüs lesen: %w", err)
	}
	defer rows.Close()
	menus := []MenuSummary{}
	for rows.Next() {
		var menu MenuSummary
		if err := rows.Scan(&menu.ID, &menu.Name, &menu.Description, &menu.Days, &menu.RecipeCount); err != nil {
			return nil, err
		}
		menus = append(menus, menu)
	}
	return menus, rows.Err()
}

func (db *DB) GetMenu(ctx context.Context, id string) (Menu, error) {
	return getMenu(ctx, db.sql, id)
}

func getMenu(ctx context.Context, q querier, id string) (Menu, error) {
	var menu Menu
	err := q.QueryRowContext(ctx, "SELECT id, name, description, days, created_at FROM menus WHERE id = ?", id).
		Scan(&menu.ID, &menu.Name, &menu.Description, &menu.Days, &menu.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Menu{}, ErrNotFound
	}
	if err != nil {
		return Menu{}, err
	}
	menu.Entries = make(map[int][]MenuEntry, menu.Days)
	for day := 1; day <= menu.Days; day++ {
		menu.Entries[day] = []MenuEntry{}
	}
	rows, err := q.QueryContext(ctx, "SELECT "+menuEntryColumns+menuEntryFrom+" WHERE e.menu_id = ?", id)
	if err != nil {
		return Menu{}, err
	}
	defer rows.Close()
	for rows.Next() {
		entry, err := scanMenuEntry(rows)
		if err != nil {
			return Menu{}, err
		}
		menu.Entries[entry.Day] = append(menu.Entries[entry.Day], entry)
	}
	if err := rows.Err(); err != nil {
		return Menu{}, err
	}
	for _, entries := range menu.Entries {
		slices.SortStableFunc(entries, func(a, b MenuEntry) int {
			if d := slices.Index(Meals, a.Meal) - slices.Index(Meals, b.Meal); d != 0 {
				return d
			}
			return a.Position - b.Position
		})
	}
	return menu, nil
}

func scanMenuEntry(s scanner) (MenuEntry, error) {
	var entry MenuEntry
	var recipeID, text, leftoverOf sql.NullString
	var servings, leftoverDay sql.NullInt64
	if err := s.Scan(&entry.ID, &entry.Day, &entry.Meal, &entry.Position, &entry.Kind, &recipeID, &servings, &text, &leftoverOf, &leftoverDay); err != nil {
		return MenuEntry{}, err
	}
	entry.RecipeID, entry.Text = recipeID.String, text.String
	if servings.Valid {
		n := int(servings.Int64)
		entry.Servings = &n
	}
	if leftoverOf.Valid {
		entry.LeftoverOf = &MenuEntryRef{ID: leftoverOf.String, Day: int(leftoverDay.Int64)}
	}
	return entry, nil
}

func (db *DB) CreateMenu(ctx context.Context, input MenuInput, dates []string) (Menu, error) {
	name, description, err := validateMenuInput(input)
	if err != nil {
		return Menu{}, err
	}
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Menu{}, err
	}
	defer tx.Rollback()

	days := input.Days
	if len(dates) > 0 {
		days = len(dates)
	}
	if days == 0 {
		days = 1
	}
	if days < 1 || days > maxMenuDays {
		return Menu{}, ErrMenuDayLimit
	}
	id := "menu-" + randomHex(6)
	if err := insertMenu(ctx, tx, id, name, description, days); err != nil {
		return Menu{}, err
	}

	if len(dates) > 0 {
		if err := db.copyPlanToMenu(ctx, tx, id, dates); err != nil {
			return Menu{}, err
		}
		var lastDay int
		if err := tx.QueryRowContext(ctx, "SELECT COALESCE(MAX(day), 0) FROM menu_entries WHERE menu_id = ?", id).Scan(&lastDay); err != nil {
			return Menu{}, err
		}
		if lastDay == 0 {
			return Menu{}, ErrEmptyMenu
		}
		if _, err := tx.ExecContext(ctx, "UPDATE menus SET days = ? WHERE id = ?", lastDay, id); err != nil {
			return Menu{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return Menu{}, err
	}
	return db.GetMenu(ctx, id)
}

func insertMenu(ctx context.Context, tx *sql.Tx, id, name, description string, days int) error {
	var exists bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM menus WHERE name_key = ?)", menuNameKey(name)).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return ErrMenuNameExists
	}
	_, err := tx.ExecContext(ctx, "INSERT INTO menus (id, name, name_key, description, days) VALUES (?, ?, ?, ?, ?)",
		id, name, menuNameKey(name), description, days)
	return err
}

func (db *DB) copyPlanToMenu(ctx context.Context, tx *sql.Tx, menuID string, dates []string) error {
	source, err := entriesBetween(ctx, tx, dates[0], dates[len(dates)-1])
	if err != nil {
		return err
	}
	copies := map[string]MenuEntry{}
	for pass := range 2 {
		for dayIndex, date := range dates {
			for _, entry := range source[date] {
				if (entry.Kind == KindLeftover) != (pass == 1) {
					continue
				}
				copy := MenuEntry{ID: "me-" + randomHex(6), Day: dayIndex + 1, Meal: entry.Meal, Position: entry.Position,
					Kind: entry.Kind, RecipeID: entry.RecipeID, Servings: entry.Servings, Text: entry.Text}
				if entry.Kind == KindLeftover {
					original, ok := copies[refID(entry.LeftoverOf)]
					if !ok {
						var title string
						if err := tx.QueryRowContext(ctx, "SELECT title FROM recipes WHERE id = ?", entry.RecipeID).Scan(&title); err != nil {
							return err
						}
						copy.Kind, copy.RecipeID, copy.Text = KindNote, "", truncate("Reste: "+title, maxEntryText)
					} else {
						copy.LeftoverOf = &MenuEntryRef{ID: original.ID, Day: original.Day}
					}
				}
				if err := insertMenuEntry(ctx, tx, menuID, copy); err != nil {
					return err
				}
				copies[entry.ID] = copy
			}
		}
	}
	return nil
}

func (db *DB) UpdateMenu(ctx context.Context, id string, input MenuInput) (Menu, error) {
	name, description, err := validateMenuInput(input)
	if err != nil {
		return Menu{}, err
	}
	result, err := db.sql.ExecContext(ctx, `UPDATE menus SET name = ?, name_key = ?, description = ?
		WHERE id = ? AND NOT EXISTS (SELECT 1 FROM menus WHERE name_key = ? AND id <> ?)`,
		name, menuNameKey(name), description, id, menuNameKey(name), id)
	if err != nil {
		return Menu{}, err
	}
	changed, _ := result.RowsAffected()
	if changed == 0 {
		var exists bool
		if err := db.sql.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM menus WHERE id = ?)", id).Scan(&exists); err != nil {
			return Menu{}, err
		}
		if !exists {
			return Menu{}, ErrNotFound
		}
		return Menu{}, ErrMenuNameExists
	}
	return db.GetMenu(ctx, id)
}

func (db *DB) DeleteMenu(ctx context.Context, id string) error {
	result, err := db.sql.ExecContext(ctx, "DELETE FROM menus WHERE id = ?", id)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return ErrNotFound
	}
	return nil
}

func (db *DB) CreateMenuEntry(ctx context.Context, menuID string, input MenuEntryInput) (Menu, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Menu{}, err
	}
	defer tx.Rollback()
	menu, err := getMenu(ctx, tx, menuID)
	if err != nil {
		return Menu{}, err
	}
	entry := MenuEntry{ID: "me-" + randomHex(6), Day: input.Day, Meal: input.Meal, Kind: input.Kind}
	if entry.Day < 1 || entry.Day > menu.Days || !IsMeal(entry.Meal) || !IsEntryKind(entry.Kind) {
		return Menu{}, ErrInvalidEntry{"Ungültiger Tag, ungültige Mahlzeit oder ungültige Art."}
	}
	switch input.Kind {
	case KindRecipe:
		recipe, err := availableRecipe(ctx, tx, input.RecipeID)
		if err != nil {
			return Menu{}, err
		}
		entry.RecipeID, entry.Servings = recipe.ID, input.Servings
		if entry.Servings == nil {
			entry.Servings = recipe.Servings
		}
	case KindLeftover:
		original, err := getMenuEntry(ctx, tx, menuID, input.LeftoverOf)
		if err != nil || original.Kind != KindRecipe {
			return Menu{}, ErrInvalidEntry{"Reste lassen sich nur zu einem Rezept dieses Menüs anlegen."}
		}
		entry.RecipeID = original.RecipeID
		entry.LeftoverOf = &MenuEntryRef{ID: original.ID, Day: original.Day}
	case KindNote, KindItem:
		entry.Text, err = entryText(input.Text)
		if err != nil {
			return Menu{}, err
		}
	}
	entry.Position, err = nextMenuPosition(ctx, tx, menuID, entry.Day, entry.Meal)
	if err != nil {
		return Menu{}, err
	}
	if err := insertMenuEntry(ctx, tx, menuID, entry); err != nil {
		return Menu{}, err
	}
	if err := tx.Commit(); err != nil {
		return Menu{}, err
	}
	return db.GetMenu(ctx, menuID)
}

func insertMenuEntry(ctx context.Context, tx *sql.Tx, menuID string, entry MenuEntry) error {
	var leftover any
	if entry.LeftoverOf != nil {
		leftover = entry.LeftoverOf.ID
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO menu_entries
		(id, menu_id, day, meal, position, kind, recipe_id, servings, text, leftover_of)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, entry.ID, menuID, entry.Day, entry.Meal, entry.Position,
		entry.Kind, nullIfEmpty(entry.RecipeID), entry.Servings, nullIfEmpty(entry.Text), leftover)
	return err
}

func getMenuEntry(ctx context.Context, q querier, menuID, id string) (MenuEntry, error) {
	entry, err := scanMenuEntry(q.QueryRowContext(ctx, "SELECT "+menuEntryColumns+menuEntryFrom+" WHERE e.menu_id = ? AND e.id = ?", menuID, id))
	if errors.Is(err, sql.ErrNoRows) {
		return MenuEntry{}, ErrNotFound
	}
	return entry, err
}

func (db *DB) UpdateMenuEntry(ctx context.Context, menuID, entryID string, patch MenuEntryPatch) (Menu, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Menu{}, err
	}
	defer tx.Rollback()
	menu, err := getMenu(ctx, tx, menuID)
	if err != nil {
		return Menu{}, err
	}
	entry, err := getMenuEntry(ctx, tx, menuID, entryID)
	if err != nil {
		return Menu{}, err
	}
	beforeDay, beforeMeal := entry.Day, entry.Meal
	if patch.Day != nil {
		entry.Day = *patch.Day
	}
	if patch.Meal != nil {
		entry.Meal = *patch.Meal
	}
	if entry.Day < 1 || entry.Day > menu.Days || !IsMeal(entry.Meal) {
		return Menu{}, ErrInvalidEntry{"Ungültiger Tag oder ungültige Mahlzeit."}
	}
	if entry.Day != beforeDay || entry.Meal != beforeMeal {
		entry.Position, err = nextMenuPosition(ctx, tx, menuID, entry.Day, entry.Meal)
		if err != nil {
			return Menu{}, err
		}
	}
	if patch.SetServings {
		if entry.Kind != KindRecipe {
			return Menu{}, ErrInvalidEntry{"Portionen gibt es nur bei Rezepteinträgen."}
		}
		entry.Servings = patch.Servings
	}
	if patch.Text != nil {
		if entry.Kind != KindNote && entry.Kind != KindItem {
			return Menu{}, ErrInvalidEntry{"Text gibt es nur bei Notizen und Zutaten."}
		}
		entry.Text, err = entryText(*patch.Text)
		if err != nil {
			return Menu{}, err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE menu_entries SET day = ?, meal = ?, position = ?, servings = ?, text = ?
		WHERE id = ? AND menu_id = ?`, entry.Day, entry.Meal, entry.Position, entry.Servings, nullIfEmpty(entry.Text), entryID, menuID); err != nil {
		return Menu{}, err
	}
	if err := tx.Commit(); err != nil {
		return Menu{}, err
	}
	return db.GetMenu(ctx, menuID)
}

func (db *DB) DeleteMenuEntry(ctx context.Context, menuID, entryID string) (Menu, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Menu{}, err
	}
	defer tx.Rollback()
	if _, err := getMenuEntry(ctx, tx, menuID, entryID); err != nil {
		return Menu{}, err
	}
	if err := deleteMenuEntries(ctx, tx, menuID, []string{entryID}); err != nil {
		return Menu{}, err
	}
	if err := tx.Commit(); err != nil {
		return Menu{}, err
	}
	return db.GetMenu(ctx, menuID)
}

func deleteMenuEntries(ctx context.Context, tx *sql.Tx, menuID string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	queryArgs := []any{menuID}
	queryArgs = append(queryArgs, args...)
	queryArgs = append(queryArgs, args...)
	rows, err := tx.QueryContext(ctx, `SELECT l.id, r.title FROM menu_entries l JOIN recipes r ON r.id = l.recipe_id
		WHERE l.menu_id = ? AND l.leftover_of IN (`+placeholders+`) AND l.id NOT IN (`+placeholders+`)`, queryArgs...)
	if err != nil {
		return err
	}
	type leftover struct{ id, title string }
	var leftovers []leftover
	for rows.Next() {
		var item leftover
		if err := rows.Scan(&item.id, &item.title); err != nil {
			rows.Close()
			return err
		}
		leftovers = append(leftovers, item)
	}
	rows.Close()
	for _, item := range leftovers {
		if _, err := tx.ExecContext(ctx, `UPDATE menu_entries SET kind = ?, recipe_id = NULL, servings = NULL,
			leftover_of = NULL, text = ? WHERE id = ?`, KindNote, truncate("Reste: "+item.title, maxEntryText), item.id); err != nil {
			return err
		}
	}
	deleteArgs := []any{menuID}
	deleteArgs = append(deleteArgs, args...)
	_, err = tx.ExecContext(ctx, "DELETE FROM menu_entries WHERE menu_id = ? AND id IN ("+placeholders+")", deleteArgs...)
	return err
}

func (db *DB) AppendMenuDay(ctx context.Context, id string) (Menu, error) {
	result, err := db.sql.ExecContext(ctx, "UPDATE menus SET days = days + 1 WHERE id = ? AND days < ?", id, maxMenuDays)
	if err != nil {
		return Menu{}, err
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		if _, err := db.GetMenu(ctx, id); err != nil {
			return Menu{}, err
		}
		return Menu{}, ErrMenuDayLimit
	}
	return db.GetMenu(ctx, id)
}

func (db *DB) RemoveMenuDay(ctx context.Context, id string, day int) (Menu, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Menu{}, err
	}
	defer tx.Rollback()
	menu, err := getMenu(ctx, tx, id)
	if err != nil {
		return Menu{}, err
	}
	if menu.Days == 1 || day < 1 || day > menu.Days {
		return Menu{}, ErrMenuDayLimit
	}
	rows, err := tx.QueryContext(ctx, "SELECT id FROM menu_entries WHERE menu_id = ? AND day = ?", id, day)
	if err != nil {
		return Menu{}, err
	}
	var ids []string
	for rows.Next() {
		var entryID string
		if err := rows.Scan(&entryID); err != nil {
			rows.Close()
			return Menu{}, err
		}
		ids = append(ids, entryID)
	}
	rows.Close()
	if err := deleteMenuEntries(ctx, tx, id, ids); err != nil {
		return Menu{}, err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE menu_entries SET day = day - 1 WHERE menu_id = ? AND day > ?", id, day); err != nil {
		return Menu{}, err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE menus SET days = days - 1 WHERE id = ?", id); err != nil {
		return Menu{}, err
	}
	if err := tx.Commit(); err != nil {
		return Menu{}, err
	}
	return db.GetMenu(ctx, id)
}

func (db *DB) ApplyMenu(ctx context.Context, id string, dates []string) ([]string, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	menu, err := getMenu(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	if len(dates) != menu.Days {
		return nil, ErrMenuDayLimit
	}
	var drafts []entryDraft
	for day := 1; day <= menu.Days; day++ {
		for _, entry := range menu.Entries[day] {
			drafts = append(drafts, entryDraft{SourceID: entry.ID, Date: dates[day-1], Meal: entry.Meal, Kind: entry.Kind,
				RecipeID: entry.RecipeID, Servings: entry.Servings, Text: entry.Text, LeftoverOf: menuRefID(entry.LeftoverOf)})
		}
	}
	skippedDrafts, err := insertPlanDrafts(ctx, tx, drafts)
	if err != nil {
		return nil, err
	}
	skipped := []string{}
	for _, draft := range skippedDrafts {
		if draft.RecipeID == "" {
			continue
		}
		var title string
		if err := tx.QueryRowContext(ctx, "SELECT title FROM recipes WHERE id = ?", draft.RecipeID).Scan(&title); err != nil {
			return nil, err
		}
		if !slices.Contains(skipped, title) {
			skipped = append(skipped, title)
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return skipped, nil
}

func nextMenuPosition(ctx context.Context, q querier, menuID string, day int, meal string) (int, error) {
	var position int
	err := q.QueryRowContext(ctx, `SELECT COALESCE(MAX(position), 0) + 1 FROM menu_entries
		WHERE menu_id = ? AND day = ? AND meal = ?`, menuID, day, meal).Scan(&position)
	return position, err
}

func validateMenuInput(input MenuInput) (string, string, error) {
	name := strings.TrimSpace(input.Name)
	description := strings.TrimSpace(input.Description)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > maxMenuName {
		return "", "", ErrInvalidEntry{"Der Name muss 1 bis 100 Zeichen lang sein."}
	}
	if utf8.RuneCountInString(description) > maxMenuDescription {
		return "", "", ErrInvalidEntry{"Die Beschreibung darf höchstens 500 Zeichen lang sein."}
	}
	return name, description, nil
}

func menuNameKey(name string) string {
	return strings.ToLower(strings.Join(strings.Fields(name), " "))
}

func menuRefID(ref *MenuEntryRef) string {
	if ref == nil {
		return ""
	}
	return ref.ID
}
