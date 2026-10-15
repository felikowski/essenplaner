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
	"unicode/utf8"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
)

const recipeColumns = `r.id, r.title, r.source_kind, r.source_ref, r.image_url, r.servings,
	r.ingredients_json, r.instructions_json, r.available, r.origin, r.edited_fields,
	r.course, r.cuisine, r.rating, r.to_try, r.notes, r.total_minutes, r.created_at,
	last_plan.last_planned_on, COALESCE(recipe_tag_list.tags_json, '[]')`

const recipeJoins = ` FROM recipes r
	LEFT JOIN (
		SELECT recipe_id, MAX(date) AS last_planned_on
		FROM plan_entries WHERE kind = 'recipe' GROUP BY recipe_id
	) last_plan ON last_plan.recipe_id = r.id
	LEFT JOIN (
		SELECT recipe_id, json_group_array(tag) AS tags_json
		FROM recipe_tags GROUP BY recipe_id
	) recipe_tag_list ON recipe_tag_list.recipe_id = r.id`

const now = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

func (db *DB) ListRecipes(ctx context.Context) ([]Recipe, error) {
	rows, err := db.sql.QueryContext(ctx, "SELECT "+recipeColumns+recipeJoins+" WHERE r.available = 1")
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
	recipe, err := scanRecipe(q.QueryRowContext(ctx, "SELECT "+recipeColumns+recipeJoins+" WHERE r.id = ?", id))
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
		r.Tags = normalizeTags(r.Tags)
		if err := validateOrganization(r); err != nil {
			return err
		}
		ingredients, err := jsonOrNull(r.Ingredients)
		if err != nil {
			return err
		}
		instructions, err := jsonOrNull(r.Instructions)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO recipes (id, title, source_kind, source_ref, image_url, servings, ingredients_json, instructions_json,
				origin, course, cuisine, rating, to_try, notes, total_minutes, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), `+now+`))`,
			r.ID, r.Title, r.Source.Kind, r.Source.Ref(), nullIfEmpty(r.ImageURL), r.Servings,
			ingredients, instructions, origin, nullIfEmpty(r.Course), nullIfEmpty(r.Cuisine), r.Rating, r.ToTry,
			nullIfEmpty(r.Notes), r.TotalMinutes, r.CreatedAt,
		); err != nil {
			return fmt.Errorf("rezept %s anlegen: %w", r.ID, err)
		}
		if err := replaceRecipeTags(ctx, tx, r.ID, r.Tags); err != nil {
			return err
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
		"SELECT "+recipeColumns+recipeJoins+" WHERE r.origin = ? AND r.canonical_url = ?", OriginWebImport, canonicalURL)
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
	course := current.Course
	if course == "" {
		course = recipe.Course
	}
	cuisine := current.Cuisine
	if cuisine == "" {
		cuisine = recipe.Cuisine
	}
	totalMinutes := current.TotalMinutes
	if totalMinutes == nil {
		totalMinutes = recipe.TotalMinutes
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE recipes SET title = ?, image_url = ?, servings = ?, ingredients_json = ?, instructions_json = ?,
			course = ?, cuisine = ?, total_minutes = ?,
			available = 1, updated_at = `+now+` WHERE id = ?`,
		recipe.Title, nullIfEmpty(recipe.ImageURL), servings, ingredients, instructions,
		nullIfEmpty(course), nullIfEmpty(cuisine), totalMinutes, id,
	); err != nil {
		return fmt.Errorf("rezept %s aus quelle übernehmen: %w", id, err)
	}
	if len(current.Tags) == 0 {
		if err := replaceRecipeTags(ctx, tx, id, recipe.Tags); err != nil {
			return err
		}
	}
	return nil
}

// UpdateRecipeOrganization ändert nur die im Patch gesetzten Felder.
func (db *DB) UpdateRecipeOrganization(ctx context.Context, id string, patch RecipeOrganizationPatch) (Recipe, error) {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return Recipe{}, err
	}
	defer tx.Rollback()

	current, err := getRecipe(ctx, tx, id)
	if err != nil {
		return Recipe{}, err
	}
	next := current.Recipe
	if patch.Course.Set {
		next.Course = strings.TrimSpace(patch.Course.Value)
	}
	if patch.Cuisine.Set {
		next.Cuisine = capitalize(strings.TrimSpace(patch.Cuisine.Value))
	}
	if patch.Tags.Set {
		next.Tags = normalizeTags(patch.Tags.Value)
	}
	if patch.Rating.Set {
		next.Rating = patch.Rating.Value
	}
	if patch.ToTry.Set {
		next.ToTry = patch.ToTry.Value
	}
	if patch.Notes.Set {
		next.Notes = strings.TrimSpace(patch.Notes.Value)
	}
	if patch.TotalMinutes.Set {
		next.TotalMinutes = patch.TotalMinutes.Value
	}
	if err := validateOrganization(next); err != nil {
		return Recipe{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE recipes SET course = ?, cuisine = ?, rating = ?, to_try = ?,
		notes = ?, total_minutes = ?, updated_at = `+now+` WHERE id = ?`,
		nullIfEmpty(next.Course), nullIfEmpty(next.Cuisine), next.Rating, next.ToTry,
		nullIfEmpty(next.Notes), next.TotalMinutes, id); err != nil {
		return Recipe{}, fmt.Errorf("einordnung von %s speichern: %w", id, err)
	}
	if patch.Tags.Set {
		if err := replaceRecipeTags(ctx, tx, id, next.Tags); err != nil {
			return Recipe{}, err
		}
	}
	updated, err := getRecipe(ctx, tx, id)
	if err != nil {
		return Recipe{}, err
	}
	return updated.Recipe, tx.Commit()
}

func validateOrganization(recipe Recipe) error {
	if recipe.Course != "" && !slices.Contains(Courses, recipe.Course) {
		return ErrInvalidOrganization{Field: "course"}
	}
	if utf8.RuneCountInString(recipe.Cuisine) > 50 {
		return ErrInvalidOrganization{Field: "cuisine"}
	}
	if len(recipe.Tags) > 20 {
		return ErrInvalidOrganization{Field: "tags"}
	}
	for _, tag := range recipe.Tags {
		if n := utf8.RuneCountInString(tag); n < 1 || n > 30 {
			return ErrInvalidOrganization{Field: "tags"}
		}
	}
	if recipe.Rating != nil && (*recipe.Rating < 1 || *recipe.Rating > 5) {
		return ErrInvalidOrganization{Field: "rating"}
	}
	if utf8.RuneCountInString(recipe.Notes) > 2000 {
		return ErrInvalidOrganization{Field: "notes"}
	}
	if recipe.TotalMinutes != nil && (*recipe.TotalMinutes < 1 || *recipe.TotalMinutes > 1440) {
		return ErrInvalidOrganization{Field: "totalMinutes"}
	}
	return nil
}

// Courses ist die feste Reihenfolge der möglichen Gänge.
var Courses = []string{"Hauptgericht", "Beilage", "Suppe", "Salat", "Vorspeise", "Dessert", "Frühstück", "Snack", "Gebäck", "Getränk", "Sauce & Dip"}

func normalizeTags(tags []string) []string {
	result := make([]string, 0, len(tags))
	seen := map[string]bool{}
	for _, tag := range tags {
		tag = strings.Join(strings.Fields(tag), " ")
		key := tagKey(tag)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, tag)
	}
	return result
}

func tagKey(tag string) string {
	return strings.ToLower(strings.Join(strings.Fields(tag), " "))
}

func capitalize(value string) string {
	runes := []rune(value)
	if len(runes) == 0 {
		return ""
	}
	runes[0] = []rune(strings.ToUpper(string(runes[0])))[0]
	return string(runes)
}

func replaceRecipeTags(ctx context.Context, tx *sql.Tx, recipeID string, tags []string) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM recipe_tags WHERE recipe_id = ?", recipeID); err != nil {
		return fmt.Errorf("tags von %s löschen: %w", recipeID, err)
	}
	for _, tag := range normalizeTags(tags) {
		if _, err := tx.ExecContext(ctx, "INSERT INTO recipe_tags (recipe_id, tag, tag_key) VALUES (?, ?, ?)", recipeID, tag, tagKey(tag)); err != nil {
			return fmt.Errorf("tag von %s speichern: %w", recipeID, err)
		}
	}
	return nil
}

func (db *DB) ListTags(ctx context.Context) ([]TagSummary, error) {
	rows, err := db.sql.QueryContext(ctx, "SELECT MIN(tag), COUNT(*) FROM recipe_tags GROUP BY tag_key")
	if err != nil {
		return nil, fmt.Errorf("tags lesen: %w", err)
	}
	defer rows.Close()
	tags := []TagSummary{}
	for rows.Next() {
		var tag TagSummary
		if err := rows.Scan(&tag.Name, &tag.Count); err != nil {
			return nil, fmt.Errorf("tag lesen: %w", err)
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	slices.SortFunc(tags, func(a, b TagSummary) int { return strings.Compare(titleSortKey(a.Name), titleSortKey(b.Name)) })
	return tags, nil
}

func (db *DB) RenameTag(ctx context.Context, key, name string) error {
	fromKey := tagKey(key)
	name = strings.Join(strings.Fields(name), " ")
	if fromKey == "" {
		return ErrNotFound
	}
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 30 {
		return ErrInvalidOrganization{Field: "name"}
	}
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var exists bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM recipe_tags WHERE tag_key = ?)", fromKey).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	toKey := tagKey(name)
	var existingName string
	if err := tx.QueryRowContext(ctx, "SELECT tag FROM recipe_tags WHERE tag_key = ? LIMIT 1", toKey).Scan(&existingName); err == nil && toKey != fromKey {
		name = existingName
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if toKey == fromKey {
		_, err = tx.ExecContext(ctx, "UPDATE recipe_tags SET tag = ? WHERE tag_key = ?", name, fromKey)
	} else {
		if _, err = tx.ExecContext(ctx, `INSERT OR IGNORE INTO recipe_tags (recipe_id, tag, tag_key)
			SELECT recipe_id, ?, ? FROM recipe_tags WHERE tag_key = ?`, name, toKey, fromKey); err == nil {
			_, err = tx.ExecContext(ctx, "DELETE FROM recipe_tags WHERE tag_key = ?", fromKey)
		}
	}
	if err != nil {
		return fmt.Errorf("tag umbenennen: %w", err)
	}
	return tx.Commit()
}

func (db *DB) DeleteTag(ctx context.Context, key string) error {
	result, err := db.sql.ExecContext(ctx, "DELETE FROM recipe_tags WHERE tag_key = ?", tagKey(key))
	if err != nil {
		return fmt.Errorf("tag löschen: %w", err)
	}
	return expectRow(result, nil)
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
		r                                      storedRecipe
		kind, ref, editedJSON, createdAt, tags string
		imageURL, course, cuisine, notes       sql.NullString
		lastPlannedOn                          sql.NullString
		servings, rating, totalMinutes         sql.NullInt64
		ingredients, instructions              sql.NullString
	)
	if err := s.Scan(&r.ID, &r.Title, &kind, &ref, &imageURL, &servings, &ingredients, &instructions,
		&r.Available, &r.origin, &editedJSON, &course, &cuisine, &rating, &r.ToTry, &notes, &totalMinutes,
		&createdAt, &lastPlannedOn, &tags); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return storedRecipe{}, err
		}
		return storedRecipe{}, fmt.Errorf("rezept lesen: %w", err)
	}
	r.Source = sourceFrom(kind, ref)
	r.ImageURL = imageURL.String
	r.Course = course.String
	r.Cuisine = cuisine.String
	r.Notes = notes.String
	r.CreatedAt = createdAt
	r.LastPlannedOn = lastPlannedOn.String
	if servings.Valid {
		n := int(servings.Int64)
		r.Servings = &n
	}
	if rating.Valid {
		n := int(rating.Int64)
		r.Rating = &n
	}
	if totalMinutes.Valid {
		n := int(totalMinutes.Int64)
		r.TotalMinutes = &n
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
	if err := json.Unmarshal([]byte(tags), &r.Tags); err != nil {
		return storedRecipe{}, fmt.Errorf("tags von %s: %w", r.ID, err)
	}
	slices.SortFunc(r.Tags, func(a, b string) int { return strings.Compare(titleSortKey(a), titleSortKey(b)) })
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
