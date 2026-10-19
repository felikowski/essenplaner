package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
	"github.com/felikowski/essenplaner/backend/internal/quantity"
	"github.com/felikowski/essenplaner/backend/internal/shopping"
)

// ErrInvalidShopping: die Änderung an der Einkaufsliste ist formal richtig, aber nicht zulässig
// (leerer Name, unbekannte Kategorie, „Sonstiges“ löschen …).
type ErrInvalidShopping struct{ Reason string }

func (e ErrInvalidShopping) Error() string { return e.Reason }

// Herkunft eines Anteils (Spalte source_kind).
const (
	PartPlan   = "plan"
	PartManual = "manual"
	PartStaple = "staple"
)

const (
	maxShoppingText = 200
	maxShoppingName = 60
	// MaxShoppingLines begrenzt, wie viele Zeilen auf einmal hinzukommen.
	MaxShoppingLines = 50
)

// MaxShoppingText ist die Höchstlänge einer Artikelzeile.
const MaxShoppingText = maxShoppingText

// ShoppingCategory ist ein Gang im Laden.
type ShoppingCategory struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Removable ist false bei „Sonstiges“.
	Removable bool `json:"removable"`
}

// Shop ist ein Geschäft, dem Artikel zugeordnet werden können.
type Shop struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ShoppingSource beschreibt, woher ein Anteil eines Artikels stammt.
type ShoppingSource struct {
	Kind        string `json:"kind"`
	RecipeID    string `json:"recipeId,omitempty"`
	RecipeTitle string `json:"recipeTitle,omitempty"`
	Date        string `json:"date,omitempty"`
	// Amount ist die Menge dieses Anteils als Text, etwa „2“ oder „333 g“.
	Amount string `json:"amount,omitempty"`
	Text   string `json:"text,omitempty"`
}

// ShoppingItem ist ein Artikel mit den aus seinen Anteilen berechneten Mengen.
type ShoppingItem struct {
	ID         string           `json:"id"`
	Name       string           `json:"name"`
	CategoryID string           `json:"categoryId"`
	StoreID    string           `json:"storeId,omitempty"`
	Checked    bool             `json:"checked"`
	Display    string           `json:"display,omitempty"`
	Amounts    []quantity.Group `json:"amounts"`
	Sources    []ShoppingSource `json:"sources"`
}

// ShoppingList ist die ganze Liste: Kategorien und Geschäfte in ihrer Reihenfolge, Artikel nach Kategorie,
// offen vor erledigt und nach Namen sortiert.
type ShoppingList struct {
	Version    int                `json:"version"`
	Categories []ShoppingCategory `json:"categories"`
	Stores     []Shop             `json:"stores"`
	Items      []ShoppingItem     `json:"items"`
}

// RecipeRef nennt ein Rezept mit Titel.
type RecipeRef struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// ShoppingAlias ist eine gemerkte Zusammenführung.
type ShoppingAlias struct {
	FromKey  string `json:"fromKey"`
	FromName string `json:"fromName"`
	ToName   string `json:"toName"`
}

// Staple ist ein Artikel der Vorratsliste.
type Staple struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

// ShoppingItemPatch ändert einzelne Angaben eines Artikels; nil bedeutet „unverändert“.
type ShoppingItemPatch struct {
	Name *string
	// Quantity ersetzt alle Anteile durch einen eigenen („500 g“; leer = ohne Menge).
	Quantity   *string
	CategoryID *string
	// SetStore ändert das Geschäft auf StoreID (nil = kein Geschäft).
	SetStore bool
	StoreID  *string
}

type ShoppingStore interface {
	ShoppingList(ctx context.Context) (ShoppingList, error)
	ShoppingVersion(ctx context.Context) (int, error)
	AddShoppingItem(ctx context.Context, text string) error
	// PreviewShoppingLines zeigt, wie Zeilen einsortiert würden, ohne zu schreiben.
	PreviewShoppingLines(ctx context.Context, texts []string) ([]ShoppingLinePreview, error)
	// AddShoppingItems fügt alle Zeilen in einem Schritt hinzu oder keine.
	AddShoppingItems(ctx context.Context, texts []string) error
	UpdateShoppingItem(ctx context.Context, id string, patch ShoppingItemPatch) error
	SetShoppingItemChecked(ctx context.Context, id string, checked bool) error
	DeleteShoppingItem(ctx context.Context, id string) error
	// MergeShoppingItem führt einen Artikel in einen anderen zusammen und merkt sich das für den Namen.
	MergeShoppingItem(ctx context.Context, id, targetID string) error
	// ImportFromPlan übernimmt die Zutaten der Einträge zwischen from und to und liefert die Rezepte ohne Zutaten.
	ImportFromPlan(ctx context.Context, from, to string) ([]RecipeRef, error)
	ClearCheckedShoppingItems(ctx context.Context) error
	CreateShoppingCategory(ctx context.Context, name string) error
	RenameShoppingCategory(ctx context.Context, id, name string) error
	DeleteShoppingCategory(ctx context.Context, id string) error
	ReorderShoppingCategories(ctx context.Context, ids []string) error
	CreateShop(ctx context.Context, name string) error
	RenameShop(ctx context.Context, id, name string) error
	DeleteShop(ctx context.Context, id string) error
	ShoppingAliases(ctx context.Context) ([]ShoppingAlias, error)
	DeleteShoppingAlias(ctx context.Context, fromKey string) error
	Staples(ctx context.Context) ([]Staple, error)
	CreateStaple(ctx context.Context, text string) error
	DeleteStaple(ctx context.Context, id string) error
	AddStaplesToList(ctx context.Context, ids []string) error
}

// seedShoppingCategories legt die eingebauten Kategorien an (Go-Schritt der Migration 5).
func seedShoppingCategories(ctx context.Context, tx *sql.Tx) error {
	for i, c := range shopping.Categories {
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO shopping_categories (id, name, position, builtin_slug) VALUES (?, ?, ?, ?)",
			"cat-"+c.Slug, c.Name, i+1, c.Slug); err != nil {
			return fmt.Errorf("kategorie %s anlegen: %w", c.Slug, err)
		}
	}
	return nil
}

// shoppingTx führt eine Änderung in einer Transaktion aus und erhöht dabei die Version der Liste.
func (db *DB) shoppingTx(ctx context.Context, change func(tx *sql.Tx) error) error {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := change(tx); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE shopping_meta SET version = version + 1 WHERE id = 1"); err != nil {
		return err
	}
	return tx.Commit()
}

func (db *DB) ShoppingVersion(ctx context.Context) (int, error) {
	var version int
	err := db.sql.QueryRowContext(ctx, "SELECT version FROM shopping_meta WHERE id = 1").Scan(&version)
	return version, err
}

type storedPart struct {
	itemID   string
	quantity *float64
	unit     string
	source   ShoppingSource
}

func (db *DB) ShoppingList(ctx context.Context) (ShoppingList, error) {
	tx, err := db.sql.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return ShoppingList{}, err
	}
	defer tx.Rollback()

	list := ShoppingList{Categories: []ShoppingCategory{}, Stores: []Shop{}, Items: []ShoppingItem{}}
	if err := tx.QueryRowContext(ctx, "SELECT version FROM shopping_meta WHERE id = 1").Scan(&list.Version); err != nil {
		return ShoppingList{}, fmt.Errorf("version lesen: %w", err)
	}
	if list.Categories, err = shoppingCategories(ctx, tx); err != nil {
		return ShoppingList{}, err
	}
	if list.Stores, err = shops(ctx, tx); err != nil {
		return ShoppingList{}, err
	}

	parts := map[string][]storedPart{}
	rows, err := tx.QueryContext(ctx,
		"SELECT item_id, quantity, unit, source_kind, entry_id, recipe_id, recipe_title, date, text FROM shopping_item_parts ORDER BY id")
	if err != nil {
		return ShoppingList{}, fmt.Errorf("anteile lesen: %w", err)
	}
	for rows.Next() {
		var (
			p                              storedPart
			q                              sql.NullFloat64
			entryID, recipeID, title, date sql.NullString
		)
		if err := rows.Scan(&p.itemID, &q, &p.unit, &p.source.Kind, &entryID, &recipeID, &title, &date, &p.source.Text); err != nil {
			rows.Close()
			return ShoppingList{}, err
		}
		if q.Valid {
			p.quantity = &q.Float64
		}
		p.source.RecipeID, p.source.RecipeTitle, p.source.Date = recipeID.String, title.String, date.String
		p.source.Amount = quantity.Format(quantity.Sum([]quantity.Part{{Quantity: p.quantity, Unit: p.unit}}))
		parts[p.itemID] = append(parts[p.itemID], p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ShoppingList{}, err
	}

	rows, err = tx.QueryContext(ctx, "SELECT id, name, category_id, store_id, checked FROM shopping_items")
	if err != nil {
		return ShoppingList{}, fmt.Errorf("artikel lesen: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			item    ShoppingItem
			storeID sql.NullString
		)
		if err := rows.Scan(&item.ID, &item.Name, &item.CategoryID, &storeID, &item.Checked); err != nil {
			return ShoppingList{}, err
		}
		item.StoreID = storeID.String
		var amounts []quantity.Part
		item.Sources = []ShoppingSource{}
		for _, p := range parts[item.ID] {
			amounts = append(amounts, quantity.Part{Quantity: p.quantity, Unit: p.unit})
			item.Sources = append(item.Sources, p.source)
		}
		item.Amounts = quantity.Sum(amounts)
		item.Display = quantity.Format(item.Amounts)
		list.Items = append(list.Items, item)
	}
	if err := rows.Err(); err != nil {
		return ShoppingList{}, err
	}

	position := map[string]int{}
	for i, c := range list.Categories {
		position[c.ID] = i
	}
	slices.SortStableFunc(list.Items, func(a, b ShoppingItem) int {
		if d := position[a.CategoryID] - position[b.CategoryID]; d != 0 {
			return d
		}
		if a.Checked != b.Checked {
			if a.Checked {
				return 1
			}
			return -1
		}
		return strings.Compare(titleSortKey(a.Name), titleSortKey(b.Name))
	})
	return list, nil
}

func shoppingCategories(ctx context.Context, q querier) ([]ShoppingCategory, error) {
	rows, err := q.QueryContext(ctx, "SELECT id, name, builtin_slug FROM shopping_categories ORDER BY position, rowid")
	if err != nil {
		return nil, fmt.Errorf("kategorien lesen: %w", err)
	}
	defer rows.Close()
	categories := []ShoppingCategory{}
	for rows.Next() {
		var (
			c    ShoppingCategory
			slug sql.NullString
		)
		if err := rows.Scan(&c.ID, &c.Name, &slug); err != nil {
			return nil, err
		}
		c.Removable = slug.String != shopping.SlugOther
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func shops(ctx context.Context, q querier) ([]Shop, error) {
	rows, err := q.QueryContext(ctx, "SELECT id, name FROM shopping_stores ORDER BY position, rowid")
	if err != nil {
		return nil, fmt.Errorf("geschäfte lesen: %w", err)
	}
	defer rows.Close()
	list := []Shop{}
	for rows.Next() {
		var s Shop
		if err := rows.Scan(&s.ID, &s.Name); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

// part ist ein neuer Anteil, bevor er einem Artikel zugeordnet ist.
type part struct {
	quantity    *float64
	unit        string
	kind        string
	entryID     string
	recipeID    string
	recipeTitle string
	date        string
	text        string
}

// addPart hängt einen Anteil an den offenen Artikel mit demselben (aufgelösten) Namen oder legt einen an.
// Neue Artikel kommen in die gemerkte oder vorgeschlagene Kategorie und ins gemerkte Geschäft.
func addPart(ctx context.Context, tx *sql.Tx, name string, p part) error {
	name = strings.Join(strings.Fields(name), " ")
	if name == "" {
		return nil
	}
	key, name, err := resolveAlias(ctx, tx, name)
	if err != nil {
		return err
	}

	itemID, err := openItem(ctx, tx, key, "")
	if err != nil {
		return err
	}
	if itemID == "" {
		categoryID, storeID, err := preferredPlace(ctx, tx, key)
		if err != nil {
			return err
		}
		itemID = "s-" + randomHex(6)
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO shopping_items (id, key, name, category_id, store_id) VALUES (?, ?, ?, ?, ?)",
			itemID, key, name, categoryID, nullIfEmpty(storeID)); err != nil {
			return fmt.Errorf("artikel anlegen: %w", err)
		}
	}
	return insertPart(ctx, tx, itemID, p)
}

// resolveAlias folgt einer gemerkten Zusammenführung und liefert Schlüssel und Namen, unter denen der Artikel landet.
func resolveAlias(ctx context.Context, tx *sql.Tx, name string) (key, resolved string, err error) {
	key = shopping.Key(name)
	var toKey, toName string
	err = tx.QueryRowContext(ctx, "SELECT to_key, to_name FROM shopping_aliases WHERE from_key = ?", key).Scan(&toKey, &toName)
	if err == nil {
		return toKey, toName, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return key, name, nil
	}
	return "", "", err
}

func insertPart(ctx context.Context, tx *sql.Tx, itemID string, p part) error {
	_, err := tx.ExecContext(ctx,
		`INSERT INTO shopping_item_parts (item_id, quantity, unit, source_kind, entry_id, recipe_id, recipe_title, date, text)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		itemID, p.quantity, p.unit, p.kind, nullIfEmpty(p.entryID), nullIfEmpty(p.recipeID), nullIfEmpty(p.recipeTitle),
		nullIfEmpty(p.date), p.text)
	if err != nil {
		return fmt.Errorf("anteil anlegen: %w", err)
	}
	return nil
}

// openItem liefert den ältesten offenen Artikel mit dem Schlüssel (außer except) oder "".
func openItem(ctx context.Context, tx *sql.Tx, key, except string) (string, error) {
	var id string
	err := tx.QueryRowContext(ctx,
		"SELECT id FROM shopping_items WHERE key = ? AND checked = 0 AND id <> ? ORDER BY created_at, rowid LIMIT 1",
		key, except).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// preferredPlace sucht Kategorie und Geschäft für einen Namen: gemerkte Wahl, sonst Vorschlag, sonst „Sonstiges“.
func preferredPlace(ctx context.Context, tx *sql.Tx, key string) (categoryID, storeID string, err error) {
	var category, store sql.NullString
	err = tx.QueryRowContext(ctx, "SELECT category_id, store_id FROM shopping_name_prefs WHERE key = ?", key).Scan(&category, &store)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", "", err
	}
	if category.Valid {
		return category.String, store.String, nil
	}
	err = tx.QueryRowContext(ctx, "SELECT id FROM shopping_categories WHERE builtin_slug = ?", shopping.Suggest(key)).Scan(&categoryID)
	if errors.Is(err, sql.ErrNoRows) {
		// Die vorgeschlagene Kategorie wurde gelöscht.
		categoryID, err = otherCategory(ctx, tx)
	}
	return categoryID, store.String, err
}

func otherCategory(ctx context.Context, q querier) (string, error) {
	var id string
	err := q.QueryRowContext(ctx, "SELECT id FROM shopping_categories WHERE builtin_slug = ?", shopping.SlugOther).Scan(&id)
	return id, err
}

func shoppingText(text string, max int, what string) (string, error) {
	text = strings.Join(strings.Fields(text), " ")
	if text == "" || utf8.RuneCountInString(text) > max {
		return "", ErrInvalidShopping{fmt.Sprintf("%s muss 1 bis %d Zeichen lang sein.", what, max)}
	}
	return text, nil
}

func (db *DB) AddShoppingItem(ctx context.Context, text string) error {
	text, err := shoppingText(text, maxShoppingText, "Der Artikel")
	if err != nil {
		return err
	}
	parsed := ingredient.Parse(text)
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return addPart(ctx, tx, parsed.Name, part{quantity: parsed.Quantity, unit: parsed.Unit, kind: PartManual, text: text})
	})
}

// ShoppingLinePreview beschreibt, wo eine Zeile landen würde.
type ShoppingLinePreview struct {
	Text       string `json:"text"`
	Name       string `json:"name"`
	CategoryID string `json:"categoryId"`
	Category   string `json:"category"`
	// MergesInto ist der Name des offenen Artikels, zu dem die Zeile käme, sonst nil.
	MergesInto *string `json:"mergesInto"`
}

// shoppingLines prüft alle Zeilen, bevor eine davon verarbeitet wird.
func shoppingLines(texts []string) ([]string, error) {
	if len(texts) == 0 || len(texts) > MaxShoppingLines {
		return nil, ErrInvalidShopping{fmt.Sprintf("Es lassen sich 1 bis %d Artikel auf einmal hinzufügen.", MaxShoppingLines)}
	}
	lines := make([]string, len(texts))
	for i, text := range texts {
		line, err := shoppingText(text, maxShoppingText, "Der Artikel")
		if err != nil {
			return nil, ErrInvalidShopping{fmt.Sprintf("Zeile %d: %s", i+1, err.Error())}
		}
		lines[i] = line
	}
	return lines, nil
}

func (db *DB) PreviewShoppingLines(ctx context.Context, texts []string) ([]ShoppingLinePreview, error) {
	lines, err := shoppingLines(texts)
	if err != nil {
		return nil, err
	}
	tx, err := db.sql.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	categories, err := shoppingCategories(ctx, tx)
	if err != nil {
		return nil, err
	}
	categoryNames := map[string]string{}
	for _, c := range categories {
		categoryNames[c.ID] = c.Name
	}
	// Gleiche Artikel innerhalb der Zeilen werden beim Speichern ebenfalls zusammengefasst.
	earlier := map[string]ShoppingLinePreview{}
	previews := make([]ShoppingLinePreview, 0, len(lines))
	for _, line := range lines {
		name := strings.Join(strings.Fields(ingredient.Parse(line).Name), " ")
		preview := ShoppingLinePreview{Text: line, Name: name}
		if name == "" {
			previews = append(previews, preview)
			continue
		}
		key, resolved, err := resolveAlias(ctx, tx, name)
		if err != nil {
			return nil, err
		}
		preview.Name = resolved
		itemID, err := openItem(ctx, tx, key, "")
		if err != nil {
			return nil, err
		}
		switch first, seen := earlier[key]; {
		case itemID != "":
			var itemName string
			if err := tx.QueryRowContext(ctx, "SELECT name, category_id FROM shopping_items WHERE id = ?", itemID).
				Scan(&itemName, &preview.CategoryID); err != nil {
				return nil, err
			}
			preview.MergesInto = &itemName
		case seen:
			preview.CategoryID, preview.MergesInto = first.CategoryID, &first.Name
		default:
			if preview.CategoryID, _, err = preferredPlace(ctx, tx, key); err != nil {
				return nil, err
			}
			earlier[key] = preview
		}
		preview.Category = categoryNames[preview.CategoryID]
		previews = append(previews, preview)
	}
	return previews, nil
}

func (db *DB) AddShoppingItems(ctx context.Context, texts []string) error {
	lines, err := shoppingLines(texts)
	if err != nil {
		return err
	}
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		for _, line := range lines {
			parsed := ingredient.Parse(line)
			if err := addPart(ctx, tx, parsed.Name, part{quantity: parsed.Quantity, unit: parsed.Unit, kind: PartManual, text: line}); err != nil {
				return err
			}
		}
		return nil
	})
}

type itemRow struct {
	id, key, name string
	checked       bool
}

func getItem(ctx context.Context, tx *sql.Tx, id string) (itemRow, error) {
	var item itemRow
	err := tx.QueryRowContext(ctx, "SELECT id, key, name, checked FROM shopping_items WHERE id = ?", id).
		Scan(&item.id, &item.key, &item.name, &item.checked)
	if errors.Is(err, sql.ErrNoRows) {
		return itemRow{}, ErrNotFound
	}
	return item, err
}

// ParseAmount liest eine von Hand eingegebene Menge wie „500 g“ oder „2“. Leer bedeutet „ohne Menge“.
func ParseAmount(text string) (*float64, string, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, "", nil
	}
	// Der Zutaten-Parser erwartet nach der Einheit einen Namen; ein Platzhalter macht „500 g“ zur Zeile.
	parsed := ingredient.Parse(text + " x")
	if parsed.Quantity == nil || parsed.Name != "x" {
		return nil, "", ErrInvalidShopping{"Die Menge wurde nicht erkannt, zum Beispiel „500 g“ oder „2“."}
	}
	return parsed.Quantity, parsed.Unit, nil
}

func (db *DB) UpdateShoppingItem(ctx context.Context, id string, patch ShoppingItemPatch) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		item, err := getItem(ctx, tx, id)
		if err != nil {
			return err
		}
		if patch.Quantity != nil {
			q, unit, err := ParseAmount(*patch.Quantity)
			if err != nil {
				return err
			}
			// Eine Menge von Hand ersetzt alle Anteile; die Herkunft geht dabei bewusst verloren.
			if _, err := tx.ExecContext(ctx, "DELETE FROM shopping_item_parts WHERE item_id = ?", id); err != nil {
				return err
			}
			if err := insertPart(ctx, tx, id, part{quantity: q, unit: unit, kind: PartManual, text: strings.TrimSpace(*patch.Quantity)}); err != nil {
				return err
			}
		}
		if patch.CategoryID != nil {
			if !exists(ctx, tx, "shopping_categories", *patch.CategoryID) {
				return ErrInvalidShopping{"Diese Kategorie gibt es nicht."}
			}
			if _, err := tx.ExecContext(ctx, "UPDATE shopping_items SET category_id = ? WHERE id = ?", *patch.CategoryID, id); err != nil {
				return err
			}
			if err := rememberPlace(ctx, tx, item.key, "category_id", *patch.CategoryID); err != nil {
				return err
			}
		}
		if patch.SetStore {
			var storeID any
			if patch.StoreID != nil {
				if !exists(ctx, tx, "shopping_stores", *patch.StoreID) {
					return ErrInvalidShopping{"Dieses Geschäft gibt es nicht."}
				}
				storeID = *patch.StoreID
			}
			if _, err := tx.ExecContext(ctx, "UPDATE shopping_items SET store_id = ? WHERE id = ?", storeID, id); err != nil {
				return err
			}
			if err := rememberPlace(ctx, tx, item.key, "store_id", storeID); err != nil {
				return err
			}
		}
		if patch.Name != nil {
			name, err := shoppingText(*patch.Name, maxShoppingText, "Der Name")
			if err != nil {
				return err
			}
			key := shopping.Key(name)
			if !item.checked {
				// Heißt danach ein anderer offener Artikel genauso, werden beide zusammengefasst.
				other, err := openItem(ctx, tx, key, id)
				if err != nil {
					return err
				}
				if other != "" {
					return moveParts(ctx, tx, id, other)
				}
			}
			if _, err := tx.ExecContext(ctx, "UPDATE shopping_items SET name = ?, key = ? WHERE id = ?", name, key, id); err != nil {
				return err
			}
		}
		return nil
	})
}

func exists(ctx context.Context, tx *sql.Tx, table, id string) bool {
	var found bool
	err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM "+table+" WHERE id = ?)", id).Scan(&found)
	return err == nil && found
}

// rememberPlace merkt sich Kategorie oder Geschäft (column) für einen Namen.
func rememberPlace(ctx context.Context, tx *sql.Tx, key, column string, value any) error {
	_, err := tx.ExecContext(ctx,
		"INSERT INTO shopping_name_prefs (key, "+column+") VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET "+column+" = excluded."+column,
		key, value)
	return err
}

// moveParts hängt alle Anteile von from an to und löscht from.
func moveParts(ctx context.Context, tx *sql.Tx, from, to string) error {
	if _, err := tx.ExecContext(ctx, "UPDATE shopping_item_parts SET item_id = ? WHERE item_id = ?", to, from); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, "DELETE FROM shopping_items WHERE id = ?", from)
	return err
}

func (db *DB) SetShoppingItemChecked(ctx context.Context, id string, checked bool) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return expectRow(tx.ExecContext(ctx, "UPDATE shopping_items SET checked = ? WHERE id = ?", checked, id))
	})
}

func (db *DB) DeleteShoppingItem(ctx context.Context, id string) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return expectRow(tx.ExecContext(ctx, "DELETE FROM shopping_items WHERE id = ?", id))
	})
}

// expectRow liefert ErrNotFound, wenn die Anweisung keine Zeile betroffen hat.
func expectRow(result sql.Result, err error) error {
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (db *DB) MergeShoppingItem(ctx context.Context, id, targetID string) error {
	if id == targetID {
		return ErrInvalidShopping{"Ein Artikel lässt sich nicht mit sich selbst zusammenführen."}
	}
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		source, err := getItem(ctx, tx, id)
		if err != nil {
			return err
		}
		target, err := getItem(ctx, tx, targetID)
		if err != nil {
			return err
		}
		if err := moveParts(ctx, tx, source.id, target.id); err != nil {
			return err
		}
		if source.key == target.key {
			return nil
		}
		// Ketten flachziehen: Was bisher bei source landete, landet jetzt direkt bei target.
		if _, err := tx.ExecContext(ctx, "UPDATE shopping_aliases SET to_key = ?, to_name = ? WHERE to_key = ?",
			target.key, target.name, source.key); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM shopping_aliases WHERE from_key = ?", target.key); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx,
			`INSERT INTO shopping_aliases (from_key, from_name, to_key, to_name) VALUES (?, ?, ?, ?)
			 ON CONFLICT (from_key) DO UPDATE SET from_name = excluded.from_name, to_key = excluded.to_key, to_name = excluded.to_name`,
			source.key, source.name, target.key, target.name)
		return err
	})
}

func (db *DB) ImportFromPlan(ctx context.Context, from, to string) ([]RecipeRef, error) {
	without := []RecipeRef{}
	err := db.shoppingTx(ctx, func(tx *sql.Tx) error {
		days, err := entriesBetween(ctx, tx, from, to)
		if err != nil {
			return err
		}
		dates := make([]string, 0, len(days))
		for date := range days {
			dates = append(dates, date)
		}
		slices.Sort(dates)
		for _, date := range dates {
			for _, e := range days[date] {
				if e.Kind != KindRecipe && e.Kind != KindItem {
					continue // Reste und Notizen brauchen keine Zutaten
				}
				var imported bool
				if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM shopping_imported_entries WHERE entry_id = ?)", e.ID).Scan(&imported); err != nil {
					return err
				}
				if imported {
					continue
				}
				if e.Kind == KindItem {
					parsed := ingredient.Parse(e.Text)
					if err := addPart(ctx, tx, parsed.Name, part{quantity: parsed.Quantity, unit: parsed.Unit, kind: PartPlan,
						entryID: e.ID, date: date, text: e.Text}); err != nil {
						return err
					}
				} else {
					recipe, err := getRecipe(ctx, tx, e.RecipeID)
					if err != nil {
						return err
					}
					if len(recipe.Ingredients) == 0 {
						// Nicht als übernommen merken: Sind die Zutaten nachgetragen, kommen sie beim nächsten Mal mit.
						if !slices.ContainsFunc(without, func(r RecipeRef) bool { return r.ID == recipe.ID }) {
							without = append(without, RecipeRef{ID: recipe.ID, Title: recipe.Title})
						}
						continue
					}
					factor := 1.0
					if e.Servings != nil && recipe.Servings != nil && *recipe.Servings > 0 {
						factor = float64(*e.Servings) / float64(*recipe.Servings)
					}
					for _, ing := range recipe.Ingredients {
						if err := addPart(ctx, tx, ing.Name, part{quantity: quantity.Scale(ing.Quantity, factor), unit: ing.Unit,
							kind: PartPlan, entryID: e.ID, recipeID: recipe.ID, recipeTitle: recipe.Title, date: date, text: ing.Text}); err != nil {
							return err
						}
					}
				}
				if _, err := tx.ExecContext(ctx, "INSERT INTO shopping_imported_entries (entry_id) VALUES (?)", e.ID); err != nil {
					return err
				}
			}
		}
		return nil
	})
	return without, err
}

func (db *DB) ClearCheckedShoppingItems(ctx context.Context) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, "DELETE FROM shopping_items WHERE checked = 1")
		return err
	})
}

func nextShoppingPosition(ctx context.Context, tx *sql.Tx, table string) (int, error) {
	var position int
	err := tx.QueryRowContext(ctx, "SELECT COALESCE(MAX(position), 0) + 1 FROM "+table).Scan(&position)
	return position, err
}

func (db *DB) CreateShoppingCategory(ctx context.Context, name string) error {
	name, err := shoppingText(name, maxShoppingName, "Der Name")
	if err != nil {
		return err
	}
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		position, err := nextShoppingPosition(ctx, tx, "shopping_categories")
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO shopping_categories (id, name, position) VALUES (?, ?, ?)",
			"cat-"+randomHex(6), name, position)
		return err
	})
}

func (db *DB) RenameShoppingCategory(ctx context.Context, id, name string) error {
	name, err := shoppingText(name, maxShoppingName, "Der Name")
	if err != nil {
		return err
	}
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return expectRow(tx.ExecContext(ctx, "UPDATE shopping_categories SET name = ? WHERE id = ?", name, id))
	})
}

// DeleteShoppingCategory löscht eine Kategorie; ihre Artikel wandern nach „Sonstiges“.
func (db *DB) DeleteShoppingCategory(ctx context.Context, id string) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		other, err := otherCategory(ctx, tx)
		if err != nil {
			return err
		}
		if id == other {
			return ErrInvalidShopping{"„Sonstiges“ lässt sich nicht löschen."}
		}
		if !exists(ctx, tx, "shopping_categories", id) {
			return ErrNotFound
		}
		if _, err := tx.ExecContext(ctx, "UPDATE shopping_items SET category_id = ? WHERE category_id = ?", other, id); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "DELETE FROM shopping_categories WHERE id = ?", id)
		return err
	})
}

// ReorderShoppingCategories setzt die Reihenfolge; ids muss alle Kategorien genau einmal enthalten.
func (db *DB) ReorderShoppingCategories(ctx context.Context, ids []string) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		current, err := shoppingCategories(ctx, tx)
		if err != nil {
			return err
		}
		known := map[string]bool{}
		for _, c := range current {
			known[c.ID] = true
		}
		for _, id := range ids {
			if !known[id] {
				return ErrInvalidShopping{"Die Reihenfolge muss jede Kategorie genau einmal enthalten."}
			}
			delete(known, id)
		}
		if len(known) > 0 {
			return ErrInvalidShopping{"Die Reihenfolge muss jede Kategorie genau einmal enthalten."}
		}
		for i, id := range ids {
			if _, err := tx.ExecContext(ctx, "UPDATE shopping_categories SET position = ? WHERE id = ?", i+1, id); err != nil {
				return err
			}
		}
		return nil
	})
}

func (db *DB) CreateShop(ctx context.Context, name string) error {
	name, err := shoppingText(name, maxShoppingName, "Der Name")
	if err != nil {
		return err
	}
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		position, err := nextShoppingPosition(ctx, tx, "shopping_stores")
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO shopping_stores (id, name, position) VALUES (?, ?, ?)",
			"shop-"+randomHex(6), name, position)
		return err
	})
}

func (db *DB) RenameShop(ctx context.Context, id, name string) error {
	name, err := shoppingText(name, maxShoppingName, "Der Name")
	if err != nil {
		return err
	}
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return expectRow(tx.ExecContext(ctx, "UPDATE shopping_stores SET name = ? WHERE id = ?", name, id))
	})
}

// DeleteShop löscht ein Geschäft; seine Artikel haben danach kein Geschäft mehr.
func (db *DB) DeleteShop(ctx context.Context, id string) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return expectRow(tx.ExecContext(ctx, "DELETE FROM shopping_stores WHERE id = ?", id))
	})
}

func (db *DB) ShoppingAliases(ctx context.Context) ([]ShoppingAlias, error) {
	rows, err := db.sql.QueryContext(ctx, "SELECT from_key, from_name, to_name FROM shopping_aliases")
	if err != nil {
		return nil, fmt.Errorf("zusammenführungen lesen: %w", err)
	}
	defer rows.Close()
	aliases := []ShoppingAlias{}
	for rows.Next() {
		var a ShoppingAlias
		if err := rows.Scan(&a.FromKey, &a.FromName, &a.ToName); err != nil {
			return nil, err
		}
		aliases = append(aliases, a)
	}
	slices.SortFunc(aliases, func(a, b ShoppingAlias) int {
		return strings.Compare(titleSortKey(a.FromName), titleSortKey(b.FromName))
	})
	return aliases, rows.Err()
}

func (db *DB) DeleteShoppingAlias(ctx context.Context, fromKey string) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return expectRow(tx.ExecContext(ctx, "DELETE FROM shopping_aliases WHERE from_key = ?", fromKey))
	})
}

func (db *DB) Staples(ctx context.Context) ([]Staple, error) {
	rows, err := db.sql.QueryContext(ctx, "SELECT id, text FROM shopping_staples ORDER BY position, rowid")
	if err != nil {
		return nil, fmt.Errorf("vorrat lesen: %w", err)
	}
	defer rows.Close()
	staples := []Staple{}
	for rows.Next() {
		var s Staple
		if err := rows.Scan(&s.ID, &s.Text); err != nil {
			return nil, err
		}
		staples = append(staples, s)
	}
	return staples, rows.Err()
}

func (db *DB) CreateStaple(ctx context.Context, text string) error {
	text, err := shoppingText(text, maxShoppingText, "Der Artikel")
	if err != nil {
		return err
	}
	key := shopping.Key(ingredient.Parse(text).Name)
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		var duplicate bool
		if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM shopping_staples WHERE key = ?)", key).Scan(&duplicate); err != nil {
			return err
		}
		if duplicate {
			return nil // schon im Vorrat
		}
		position, err := nextShoppingPosition(ctx, tx, "shopping_staples")
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO shopping_staples (id, text, key, position) VALUES (?, ?, ?, ?)",
			"st-"+randomHex(6), text, key, position)
		return err
	})
}

func (db *DB) DeleteStaple(ctx context.Context, id string) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		return expectRow(tx.ExecContext(ctx, "DELETE FROM shopping_staples WHERE id = ?", id))
	})
}

func (db *DB) AddStaplesToList(ctx context.Context, ids []string) error {
	return db.shoppingTx(ctx, func(tx *sql.Tx) error {
		for _, id := range ids {
			var text string
			err := tx.QueryRowContext(ctx, "SELECT text FROM shopping_staples WHERE id = ?", id).Scan(&text)
			if errors.Is(err, sql.ErrNoRows) {
				return ErrNotFound
			}
			if err != nil {
				return err
			}
			parsed := ingredient.Parse(text)
			if err := addPart(ctx, tx, parsed.Name, part{quantity: parsed.Quantity, unit: parsed.Unit, kind: PartStaple, text: text}); err != nil {
				return err
			}
		}
		return nil
	})
}
