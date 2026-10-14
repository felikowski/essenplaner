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

// Mahlzeiten in der Reihenfolge, in der sie angezeigt werden.
var Meals = []string{"breakfast", "lunch", "dinner", "snack"}

// Arten von Planeinträgen.
const (
	KindRecipe   = "recipe"
	KindNote     = "note"
	KindItem     = "item"
	KindLeftover = "leftover"
)

var entryKinds = []string{KindRecipe, KindNote, KindItem, KindLeftover}

const maxEntryText = 200

// ErrInvalidEntry: der Eintrag ist formal richtig, verweist aber auf etwas Unzulässiges
// (unbekanntes oder entferntes Rezept, Reste ohne Rezepteintrag, zu langer Text).
type ErrInvalidEntry struct{ Reason string }

func (e ErrInvalidEntry) Error() string { return e.Reason }

// Entry ist ein Eintrag im Wochenplan.
type Entry struct {
	ID         string    `json:"id"`
	Date       string    `json:"-"`
	Meal       string    `json:"meal"`
	Position   int       `json:"position"`
	Kind       string    `json:"kind"`
	RecipeID   string    `json:"recipeId,omitempty"`
	Servings   *int      `json:"servings,omitempty"`
	Text       string    `json:"text,omitempty"`
	LeftoverOf *EntryRef `json:"leftoverOf,omitempty"`
}

// EntryRef verweist auf einen anderen Eintrag samt seinem Datum.
type EntryRef struct {
	ID   string `json:"id"`
	Date string `json:"date"`
}

// EntryInput beschreibt einen neuen Eintrag.
type EntryInput struct {
	Date       string
	Meal       string
	Kind       string
	RecipeID   string
	Servings   *int
	Text       string
	LeftoverOf string
}

// EntryPatch ändert einzelne Angaben eines Eintrags; nil bedeutet „unverändert“.
type EntryPatch struct {
	Date *string
	Meal *string
	// SetServings ändert die Portionen auf Servings (nil entfernt die Angabe).
	SetServings bool
	Servings    *int
	Text        *string
}

func IsMeal(meal string) bool      { return slices.Contains(Meals, meal) }
func IsEntryKind(kind string) bool { return slices.Contains(entryKinds, kind) }

const entryColumns = `e.id, e.date, e.meal, e.position, e.kind, e.recipe_id, e.servings, e.text, e.leftover_of, o.date`

const entryFrom = ` FROM plan_entries e LEFT JOIN plan_entries o ON o.id = e.leftover_of`

func scanEntry(s scanner) (Entry, error) {
	var (
		e                                  Entry
		recipeID, text, leftoverOf, ofDate sql.NullString
		servings                           sql.NullInt64
	)
	if err := s.Scan(&e.ID, &e.Date, &e.Meal, &e.Position, &e.Kind, &recipeID, &servings, &text, &leftoverOf, &ofDate); err != nil {
		return Entry{}, err
	}
	e.RecipeID = recipeID.String
	e.Text = text.String
	if servings.Valid {
		n := int(servings.Int64)
		e.Servings = &n
	}
	if leftoverOf.Valid {
		e.LeftoverOf = &EntryRef{ID: leftoverOf.String, Date: ofDate.String}
	}
	return e, nil
}

type querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Entries liefert alle Einträge zwischen from und to einschließlich, je Datum nach Mahlzeit und Position sortiert.
func (db *DB) Entries(ctx context.Context, from, to string) (map[string][]Entry, error) {
	return entriesBetween(ctx, db.sql, from, to)
}

func entriesBetween(ctx context.Context, q querier, from, to string) (map[string][]Entry, error) {
	rows, err := q.QueryContext(ctx, "SELECT "+entryColumns+entryFrom+" WHERE e.date BETWEEN ? AND ?", from, to)
	if err != nil {
		return nil, fmt.Errorf("plan lesen: %w", err)
	}
	defer rows.Close()
	days := map[string][]Entry{}
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			return nil, fmt.Errorf("plan lesen: %w", err)
		}
		days[e.Date] = append(days[e.Date], e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("plan lesen: %w", err)
	}
	for _, entries := range days {
		sortEntries(entries)
	}
	return days, nil
}

func sortEntries(entries []Entry) {
	slices.SortStableFunc(entries, func(a, b Entry) int {
		if d := slices.Index(Meals, a.Meal) - slices.Index(Meals, b.Meal); d != 0 {
			return d
		}
		return a.Position - b.Position
	})
}

// GetEntry liefert einen Eintrag oder ErrNotFound.
func (db *DB) GetEntry(ctx context.Context, id string) (Entry, error) {
	return getEntry(ctx, db.sql, id)
}

func getEntry(ctx context.Context, q querier, id string) (Entry, error) {
	e, err := scanEntry(q.QueryRowContext(ctx, "SELECT "+entryColumns+entryFrom+" WHERE e.id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return Entry{}, ErrNotFound
	}
	return e, err
}

// CreateEntry legt einen Eintrag am Ende seiner Mahlzeit an. Rezepteinträge übernehmen ohne Angabe die
// Portionen des Rezepts, Reste das Rezept ihres Originals.
func (db *DB) CreateEntry(ctx context.Context, input EntryInput) (Entry, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Entry{}, err
	}
	defer tx.Rollback()

	e := Entry{ID: "e-" + randomHex(6), Date: input.Date, Meal: input.Meal, Kind: input.Kind}
	switch input.Kind {
	case KindRecipe:
		recipe, err := availableRecipe(ctx, tx, input.RecipeID)
		if err != nil {
			return Entry{}, err
		}
		e.RecipeID = recipe.ID
		e.Servings = input.Servings
		if e.Servings == nil {
			e.Servings = recipe.Servings
		}
	case KindLeftover:
		original, err := getEntry(ctx, tx, input.LeftoverOf)
		if err != nil || original.Kind != KindRecipe {
			return Entry{}, ErrInvalidEntry{"Reste lassen sich nur zu einem eingeplanten Rezept anlegen."}
		}
		e.RecipeID = original.RecipeID
		e.LeftoverOf = &EntryRef{ID: original.ID, Date: original.Date}
	case KindNote, KindItem:
		text, err := entryText(input.Text)
		if err != nil {
			return Entry{}, err
		}
		e.Text = text
	}
	if e.Position, err = nextPosition(ctx, tx, e.Date, e.Meal); err != nil {
		return Entry{}, err
	}
	if err := insertEntry(ctx, tx, e); err != nil {
		return Entry{}, err
	}
	return e, tx.Commit()
}

func insertEntry(ctx context.Context, tx *sql.Tx, e Entry) error {
	var leftoverOf any
	if e.LeftoverOf != nil {
		leftoverOf = e.LeftoverOf.ID
	}
	_, err := tx.ExecContext(ctx,
		`INSERT INTO plan_entries (id, date, meal, position, kind, recipe_id, servings, text, leftover_of)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.ID, e.Date, e.Meal, e.Position, e.Kind, nullIfEmpty(e.RecipeID), e.Servings, nullIfEmpty(e.Text), leftoverOf)
	if err != nil {
		return fmt.Errorf("eintrag anlegen: %w", err)
	}
	return nil
}

// UpdateEntry ändert Datum, Mahlzeit, Portionen oder Text. Wer Datum oder Mahlzeit ändert, landet am Ende der
// Zielmahlzeit. Liefert den Eintrag vor und nach der Änderung.
func (db *DB) UpdateEntry(ctx context.Context, id string, patch EntryPatch) (before, after Entry, err error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Entry{}, Entry{}, err
	}
	defer tx.Rollback()

	before, err = getEntry(ctx, tx, id)
	if err != nil {
		return Entry{}, Entry{}, err
	}
	after = before
	if patch.Date != nil {
		after.Date = *patch.Date
	}
	if patch.Meal != nil {
		after.Meal = *patch.Meal
	}
	if after.Date != before.Date || after.Meal != before.Meal {
		if after.Position, err = nextPosition(ctx, tx, after.Date, after.Meal); err != nil {
			return Entry{}, Entry{}, err
		}
	}
	if patch.SetServings {
		if before.Kind != KindRecipe {
			return Entry{}, Entry{}, ErrInvalidEntry{"Portionen gibt es nur bei Rezepteinträgen."}
		}
		after.Servings = patch.Servings
	}
	if patch.Text != nil {
		if before.Kind != KindNote && before.Kind != KindItem {
			return Entry{}, Entry{}, ErrInvalidEntry{"Text gibt es nur bei Notizen und Zutaten."}
		}
		if after.Text, err = entryText(*patch.Text); err != nil {
			return Entry{}, Entry{}, err
		}
	}
	if _, err := tx.ExecContext(ctx,
		"UPDATE plan_entries SET date = ?, meal = ?, position = ?, servings = ?, text = ? WHERE id = ?",
		after.Date, after.Meal, after.Position, after.Servings, nullIfEmpty(after.Text), id); err != nil {
		return Entry{}, Entry{}, fmt.Errorf("eintrag ändern: %w", err)
	}
	return before, after, tx.Commit()
}

// DeleteEntry löscht einen Eintrag. Reste, die auf ihn verweisen, werden zu Notizen „Reste: <Titel>“.
// Liefert die Daten aller betroffenen Tage (der Eintrag selbst und umgewandelte Reste).
func (db *DB) DeleteEntry(ctx context.Context, id string) ([]string, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	entry, err := getEntry(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	dates, err := deleteEntries(ctx, tx, []string{id})
	if err != nil {
		return nil, err
	}
	return append(dates, entry.Date), tx.Commit()
}

// deleteEntries löscht Einträge und wandelt Reste, die auf sie verweisen (und selbst nicht gelöscht werden),
// in Notizen um. Liefert die Daten der umgewandelten Reste.
func deleteEntries(ctx context.Context, tx *sql.Tx, ids []string) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}

	rows, err := tx.QueryContext(ctx, `SELECT l.id, l.date, r.title FROM plan_entries l JOIN recipes r ON r.id = l.recipe_id
		WHERE l.leftover_of IN (`+placeholders+`) AND l.id NOT IN (`+placeholders+`)`, append(args, args...)...)
	if err != nil {
		return nil, err
	}
	type leftover struct{ id, date, title string }
	var leftovers []leftover
	for rows.Next() {
		var l leftover
		if err := rows.Scan(&l.id, &l.date, &l.title); err != nil {
			rows.Close()
			return nil, err
		}
		leftovers = append(leftovers, l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var dates []string
	for _, l := range leftovers {
		if _, err := tx.ExecContext(ctx,
			"UPDATE plan_entries SET kind = ?, recipe_id = NULL, servings = NULL, leftover_of = NULL, text = ? WHERE id = ?",
			KindNote, truncate("Reste: "+l.title, maxEntryText), l.id); err != nil {
			return nil, fmt.Errorf("reste umwandeln: %w", err)
		}
		dates = append(dates, l.date)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM plan_entries WHERE id IN ("+placeholders+")", args...); err != nil {
		return nil, fmt.Errorf("einträge löschen: %w", err)
	}
	return dates, nil
}

// CopyWeek kopiert alle Einträge der Tage from auf die Tage to (gleicher Index = gleicher Wochentag).
// Mit replace werden die Einträge der Zielwoche vorher gelöscht. Einträge mit nicht mehr verfügbaren Rezepten
// werden übersprungen und gezählt; Reste verweisen auf die Kopie ihres Originals.
func (db *DB) CopyWeek(ctx context.Context, from, to []string, replace bool) (skipped int, err error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	source, err := entriesBetween(ctx, tx, from[0], from[len(from)-1])
	if err != nil {
		return 0, err
	}
	if replace {
		target, err := entriesBetween(ctx, tx, to[0], to[len(to)-1])
		if err != nil {
			return 0, err
		}
		var ids []string
		for _, entries := range target {
			for _, e := range entries {
				ids = append(ids, e.ID)
			}
		}
		if _, err := deleteEntries(ctx, tx, ids); err != nil {
			return 0, err
		}
	}

	// Erst Rezepte und Notizen, dann Reste, damit deren Originale schon kopiert sind.
	copies := map[string]Entry{}
	for pass := range 2 {
		for i, date := range from {
			for _, e := range source[date] {
				if (e.Kind == KindLeftover) != (pass == 1) {
					continue
				}
				c := e
				c.ID = "e-" + randomHex(6)
				c.Date = to[i]
				switch e.Kind {
				case KindRecipe:
					if _, err := availableRecipe(ctx, tx, e.RecipeID); err != nil {
						skipped++
						continue
					}
				case KindLeftover:
					original, ok := copies[refID(e.LeftoverOf)]
					if !ok {
						skipped++
						continue
					}
					c.LeftoverOf = &EntryRef{ID: original.ID, Date: original.Date}
				}
				if c.Position, err = nextPosition(ctx, tx, c.Date, c.Meal); err != nil {
					return 0, err
				}
				if err := insertEntry(ctx, tx, c); err != nil {
					return 0, err
				}
				copies[e.ID] = c
			}
		}
	}
	return skipped, tx.Commit()
}

func refID(ref *EntryRef) string {
	if ref == nil {
		return ""
	}
	return ref.ID
}

// RecipeHistory liefert die Daten, an denen ein Rezept geplant war (ohne Reste), neueste zuerst.
func (db *DB) RecipeHistory(ctx context.Context, recipeID string) ([]string, error) {
	rows, err := db.sql.QueryContext(ctx,
		"SELECT date FROM plan_entries WHERE recipe_id = ? AND kind = ? ORDER BY date DESC", recipeID, KindRecipe)
	if err != nil {
		return nil, fmt.Errorf("verlauf lesen: %w", err)
	}
	defer rows.Close()
	dates := []string{}
	for rows.Next() {
		var date string
		if err := rows.Scan(&date); err != nil {
			return nil, err
		}
		dates = append(dates, date)
	}
	return dates, rows.Err()
}

func nextPosition(ctx context.Context, q querier, date, meal string) (int, error) {
	var position int
	err := q.QueryRowContext(ctx, "SELECT COALESCE(MAX(position), 0) + 1 FROM plan_entries WHERE date = ? AND meal = ?",
		date, meal).Scan(&position)
	return position, err
}

func availableRecipe(ctx context.Context, q queryer, id string) (Recipe, error) {
	recipe, err := getRecipe(ctx, q, id)
	if errors.Is(err, ErrNotFound) || (err == nil && !recipe.Available) {
		return Recipe{}, ErrInvalidEntry{"Dieses Rezept gibt es nicht oder es ist nicht mehr verfügbar."}
	}
	return recipe.Recipe, err
}

func entryText(text string) (string, error) {
	text = strings.TrimSpace(text)
	if text == "" || utf8.RuneCountInString(text) > maxEntryText {
		return "", ErrInvalidEntry{fmt.Sprintf("Der Text muss 1 bis %d Zeichen lang sein.", maxEntryText)}
	}
	return text, nil
}

func truncate(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}
