package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
)

const recipeColumns = `id, title, source_kind, source_ref, image_url, servings, ingredients_json, instructions_json, available, origin, edited_fields`

const now = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

func (db *DB) ListRecipes(ctx context.Context) ([]Recipe, error) {
	rows, err := db.sql.QueryContext(ctx, "SELECT "+recipeColumns+" FROM recipes WHERE available = 1")
	if err != nil {
		return nil, fmt.Errorf("rezepte lesen: %w", err)
	}
	defer rows.Close()

	recipes := []Recipe{}
	for rows.Next() {
		recipe, err := scanRecipe(rows)
		if err != nil {
			return nil, err
		}
		recipes = append(recipes, recipe.Recipe)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rezepte lesen: %w", err)
	}

	// Sortiert wird in Go, weil SQLite Umlaute nicht wie im Deutschen einordnet.
	slices.SortFunc(recipes, func(a, b Recipe) int {
		return strings.Compare(titleSortKey(a.Title), titleSortKey(b.Title))
	})
	return recipes, nil
}

func (db *DB) GetRecipe(ctx context.Context, id string) (Recipe, error) {
	recipe, err := getRecipe(ctx, db.sql, id)
	return recipe.Recipe, err
}

type queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func getRecipe(ctx context.Context, q queryer, id string) (storedRecipe, error) {
	recipe, err := scanRecipe(q.QueryRowContext(ctx, "SELECT "+recipeColumns+" FROM recipes WHERE id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return storedRecipe{}, ErrNotFound
	}
	return recipe, err
}

// CountRecipes zählt alle Rezepte.
func (db *DB) CountRecipes(ctx context.Context) (int, error) {
	var count int
	if err := db.sql.QueryRowContext(ctx, "SELECT COUNT(*) FROM recipes").Scan(&count); err != nil {
		return 0, fmt.Errorf("rezepte zählen: %w", err)
	}
	return count, nil
}

// InsertRecipes legt Rezepte mit der angegebenen Herkunft (z. B. "seed") in einer Transaktion an.
func (db *DB) InsertRecipes(ctx context.Context, origin string, recipes []Recipe) error {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, r := range recipes {
		ingredients, err := jsonOrNull(r.Ingredients)
		if err != nil {
			return err
		}
		instructions, err := jsonOrNull(r.Instructions)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO recipes (id, title, source_kind, source_ref, image_url, servings, ingredients_json, instructions_json, origin)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			r.ID, r.Title, r.Source.Kind, r.Source.Ref(), nullIfEmpty(r.ImageURL), r.Servings,
			ingredients, instructions, origin,
		); err != nil {
			return fmt.Errorf("rezept %s anlegen: %w", r.ID, err)
		}
	}
	return tx.Commit()
}

// CreateRecipe legt ein eigenes Rezept an und zerlegt dabei die Zutaten.
func (db *DB) CreateRecipe(ctx context.Context, input RecipeInput) (Recipe, error) {
	ingredients, err := jsonOrNull(ingredient.ParseAll(input.Ingredients))
	if err != nil {
		return Recipe{}, err
	}
	instructions, err := jsonOrNull(nonEmpty(input.Instructions))
	if err != nil {
		return Recipe{}, err
	}
	id := "m-" + randomHex(6)
	if _, err := db.sql.ExecContext(ctx,
		`INSERT INTO recipes (id, title, source_kind, source_ref, servings, ingredients_json, instructions_json, origin)
		 VALUES (?, ?, ?, '', ?, ?, ?, ?)`,
		id, strings.TrimSpace(input.Title), SourceManual, input.Servings, ingredients, instructions, OriginManual,
	); err != nil {
		return Recipe{}, fmt.Errorf("rezept anlegen: %w", err)
	}
	return db.GetRecipe(ctx, id)
}

// UpdateRecipe ersetzt die bearbeitbaren Angaben. In edited_fields landen nur Felder, deren Wert sich
// tatsächlich ändert: Wer nur Zutaten nachträgt, sperrt damit nicht die Portionen für spätere Importe.
func (db *DB) UpdateRecipe(ctx context.Context, id string, input RecipeInput) (Recipe, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Recipe{}, err
	}
	defer tx.Rollback()

	current, err := getRecipe(ctx, tx, id)
	if err != nil {
		return Recipe{}, err
	}
	title := strings.TrimSpace(input.Title)
	if title != current.Title && current.origin != OriginManual {
		return Recipe{}, ErrTitleNotEditable
	}

	parsed := ingredient.ParseAll(input.Ingredients)
	instructionList := nonEmpty(input.Instructions)
	edited := current.edited
	if !sameInt(current.Servings, input.Servings) {
		edited = addField(edited, FieldServings)
	}
	if !sameJSON(current.Ingredients, parsed) {
		edited = addField(edited, FieldIngredients)
	}
	if !sameJSON(current.Instructions, instructionList) {
		edited = addField(edited, FieldInstructions)
	}

	ingredients, err := jsonOrNull(parsed)
	if err != nil {
		return Recipe{}, err
	}
	instructions, err := jsonOrNull(instructionList)
	if err != nil {
		return Recipe{}, err
	}
	editedJSON, err := json.Marshal(edited)
	if err != nil {
		return Recipe{}, err
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE recipes SET title = ?, servings = ?, ingredients_json = ?, instructions_json = ?, edited_fields = ?,
		 updated_at = `+now+` WHERE id = ?`,
		title, input.Servings, ingredients, instructions, string(editedJSON), id,
	); err != nil {
		return Recipe{}, fmt.Errorf("rezept %s speichern: %w", id, err)
	}
	updated, err := getRecipe(ctx, tx, id)
	if err != nil {
		return Recipe{}, err
	}
	return updated.Recipe, tx.Commit()
}

// FindImported sucht ein per URL importiertes Rezept über seine kanonische Adresse.
func (db *DB) FindImported(ctx context.Context, canonicalURL string) (Recipe, error) {
	row := db.sql.QueryRowContext(ctx,
		"SELECT "+recipeColumns+" FROM recipes WHERE origin = ? AND canonical_url = ?", OriginWebImport, canonicalURL)
	recipe, err := scanRecipe(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Recipe{}, ErrNotFound
	}
	return recipe.Recipe, err
}

// SaveImported legt ein importiertes Rezept an. Gibt es die Adresse schon, werden Titel, Bild und alle nicht
// von Hand bearbeiteten Felder aus der Quelle übernommen, und das Rezept wird wieder verfügbar.
func (db *DB) SaveImported(ctx context.Context, canonicalURL string, recipe Recipe) (Recipe, bool, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Recipe{}, false, err
	}
	defer tx.Rollback()

	var id string
	err = tx.QueryRowContext(ctx, "SELECT id FROM recipes WHERE origin = ? AND canonical_url = ?",
		OriginWebImport, canonicalURL).Scan(&id)
	created := errors.Is(err, sql.ErrNoRows)
	if err != nil && !created {
		return Recipe{}, false, fmt.Errorf("import suchen: %w", err)
	}
	if created {
		id = "w-" + randomHex(6)
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO recipes (id, title, source_kind, source_ref, origin, canonical_url) VALUES (?, ?, ?, ?, ?, ?)`,
			id, recipe.Title, SourceWeb, canonicalURL, OriginWebImport, canonicalURL,
		); err != nil {
			return Recipe{}, false, fmt.Errorf("importiertes rezept anlegen: %w", err)
		}
	}
	if err := upsertFromSource(ctx, tx, id, recipe); err != nil {
		return Recipe{}, false, err
	}
	saved, err := getRecipe(ctx, tx, id)
	if err != nil {
		return Recipe{}, false, err
	}
	return saved.Recipe, created, tx.Commit()
}

// upsertFromSource übernimmt Angaben aus einer Rezeptquelle (Web-Import, später Drive), ohne Felder in
// edited_fields zu überschreiben, und macht das Rezept wieder verfügbar.
func upsertFromSource(ctx context.Context, tx *sql.Tx, id string, recipe Recipe) error {
	current, err := getRecipe(ctx, tx, id)
	if err != nil {
		return err
	}
	servings, ingredients, instructions := recipe.Servings, any(nil), any(nil)
	if ingredients, err = jsonOrNull(recipe.Ingredients); err != nil {
		return err
	}
	if instructions, err = jsonOrNull(recipe.Instructions); err != nil {
		return err
	}
	if slices.Contains(current.edited, FieldServings) {
		servings = current.Servings
	}
	if slices.Contains(current.edited, FieldIngredients) {
		if ingredients, err = jsonOrNull(current.Ingredients); err != nil {
			return err
		}
	}
	if slices.Contains(current.edited, FieldInstructions) {
		if instructions, err = jsonOrNull(current.Instructions); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE recipes SET title = ?, image_url = ?, servings = ?, ingredients_json = ?, instructions_json = ?,
		 available = 1, updated_at = `+now+` WHERE id = ?`,
		recipe.Title, nullIfEmpty(recipe.ImageURL), servings, ingredients, instructions, id,
	); err != nil {
		return fmt.Errorf("rezept %s aus quelle übernehmen: %w", id, err)
	}
	return nil
}

// RemoveRecipe markiert ein Rezept als nicht mehr verfügbar. Es bleibt in bestehenden Plänen erhalten.
func (db *DB) RemoveRecipe(ctx context.Context, id string) error {
	var origin string
	err := db.sql.QueryRowContext(ctx, "SELECT origin FROM recipes WHERE id = ?", id).Scan(&origin)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("rezept lesen: %w", err)
	}
	if !isRemovable(origin) {
		return ErrNotRemovable
	}
	if _, err := db.sql.ExecContext(ctx,
		"UPDATE recipes SET available = 0, updated_at = "+now+" WHERE id = ?", id); err != nil {
		return fmt.Errorf("rezept entfernen: %w", err)
	}
	return nil
}

func isRemovable(origin string) bool {
	return origin == OriginWebImport || origin == OriginManual
}

func randomHex(bytes int) string {
	b := make([]byte, bytes)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand schlägt auf unterstützten Systemen nicht fehl
	}
	return hex.EncodeToString(b)
}

// storedRecipe ist ein Rezept mit Feldern, die nur der Store braucht.
type storedRecipe struct {
	Recipe
	origin string
	edited []string
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRecipe(s scanner) (storedRecipe, error) {
	var (
		r                         storedRecipe
		kind, ref, editedJSON     string
		imageURL                  sql.NullString
		servings                  sql.NullInt64
		ingredients, instructions sql.NullString
	)
	if err := s.Scan(&r.ID, &r.Title, &kind, &ref, &imageURL, &servings, &ingredients, &instructions,
		&r.Available, &r.origin, &editedJSON); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return storedRecipe{}, err
		}
		return storedRecipe{}, fmt.Errorf("rezept lesen: %w", err)
	}
	r.Source = sourceFrom(kind, ref)
	r.ImageURL = imageURL.String
	if servings.Valid {
		n := int(servings.Int64)
		r.Servings = &n
	}
	r.Removable = r.Available && isRemovable(r.origin)
	r.TitleEditable = r.origin == OriginManual
	if err := unmarshalList(ingredients, &r.Ingredients); err != nil {
		return storedRecipe{}, fmt.Errorf("zutaten von %s: %w", r.ID, err)
	}
	if err := unmarshalList(instructions, &r.Instructions); err != nil {
		return storedRecipe{}, fmt.Errorf("zubereitung von %s: %w", r.ID, err)
	}
	if err := json.Unmarshal([]byte(editedJSON), &r.edited); err != nil {
		return storedRecipe{}, fmt.Errorf("bearbeitete felder von %s: %w", r.ID, err)
	}
	return r, nil
}

func unmarshalList[T any](value sql.NullString, target *[]T) error {
	if !value.Valid {
		return nil
	}
	return json.Unmarshal([]byte(value.String), target)
}

func jsonOrNull[T any](list []T) (any, error) {
	if len(list) == 0 {
		return nil, nil
	}
	data, err := json.Marshal(list)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}

func nullIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func nonEmpty(lines []string) []string {
	var result []string
	for _, line := range lines {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func addField(fields []string, field string) []string {
	if slices.Contains(fields, field) {
		return fields
	}
	return append(slices.Clone(fields), field)
}

func sameInt(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

// sameJSON vergleicht zwei Listen über ihre JSON-Darstellung; leere Listen und nil gelten als gleich.
func sameJSON[T any](a, b []T) bool {
	if len(a) == 0 || len(b) == 0 {
		return len(a) == len(b)
	}
	ja, errA := json.Marshal(a)
	jb, errB := json.Marshal(b)
	return errA == nil && errB == nil && string(ja) == string(jb)
}

var umlauts = strings.NewReplacer("ä", "a", "ö", "o", "ü", "u", "ß", "ss")

// titleSortKey ordnet Umlaute wie ihre Grundbuchstaben ein ("Ä" wie "A") und ignoriert Groß-/Kleinschreibung.
func titleSortKey(title string) string {
	return umlauts.Replace(strings.ToLower(title))
}
