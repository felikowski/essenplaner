package store

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestRecipeOrganizationMigration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	raw, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := raw.Exec(`CREATE TABLE schema_migrations (
		version INTEGER PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	)`); err != nil {
		t.Fatal(err)
	}
	partial := &DB{sql: raw}
	for version, file := range []string{"migrations/001_init.sql", "migrations/002_web_import.sql", "migrations/003_recipe_editor.sql", "migrations/004_plan_entries.sql", "migrations/005_shopping.sql"} {
		v := version + 1
		if err := partial.applyMigration(context.Background(), v, file, goMigrations[v]); err != nil {
			t.Fatalf("migration %d: %v", v, err)
		}
	}
	if _, err := raw.Exec(`INSERT INTO recipes (id, title, source_kind, source_ref, origin) VALUES ('alt', 'Altes Rezept', 'manual', '', 'manual')`); err != nil {
		t.Fatal(err)
	}
	raw.Close()

	db := openTestDB(t, path)
	recipe, err := db.GetRecipe(context.Background(), "alt")
	if err != nil || recipe.Title != "Altes Rezept" || recipe.ToTry || recipe.CreatedAt == "" {
		t.Fatalf("bestehendes rezept nach migration = %+v, %v", recipe, err)
	}
	if _, err := db.sql.Exec("UPDATE recipes SET rating = 6 WHERE id = 'alt'"); err == nil {
		t.Error("CHECK für Bewertung fehlt")
	}
	if _, err := db.sql.Exec("INSERT INTO recipe_tags (recipe_id, tag, tag_key) VALUES ('fehlt', 'Schnell', 'schnell')"); err == nil {
		t.Error("Fremdschlüssel der Tags fehlt")
	}
}

func TestUpdateRecipeOrganizationAndLastPlannedOn(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	patch := RecipeOrganizationPatch{
		Course:       Optional[string]{Set: true, Value: "Hauptgericht"},
		Cuisine:      Optional[string]{Set: true, Value: "indisch"},
		Tags:         Optional[[]string]{Set: true, Value: []string{"Schnell", "schnell", "Kinder mögen’s"}},
		Rating:       Optional[*int]{Set: true, Value: intPtr(4)},
		ToTry:        Optional[bool]{Set: true, Value: true},
		Notes:        Optional[string]{Set: true, Value: " mit weniger Chili "},
		TotalMinutes: Optional[*int]{Set: true, Value: intPtr(30)},
	}
	got, err := db.UpdateRecipeOrganization(ctx, "haehnchen-curry", patch)
	if err != nil {
		t.Fatal(err)
	}
	if got.Course != "Hauptgericht" || got.Cuisine != "Indisch" || got.Rating == nil || *got.Rating != 4 ||
		!got.ToTry || got.Notes != "mit weniger Chili" || got.TotalMinutes == nil || *got.TotalMinutes != 30 ||
		!slices.Equal(got.Tags, []string{"Kinder mögen’s", "Schnell"}) {
		t.Errorf("einordnung = %+v", got)
	}

	// Eine Teiländerung lässt alle nicht übergebenen Angaben unverändert.
	updated, err := db.UpdateRecipeOrganization(ctx, got.ID, RecipeOrganizationPatch{Rating: Optional[*int]{Set: true, Value: intPtr(5)}})
	if err != nil || updated.Course != got.Course || updated.Notes != got.Notes || *updated.Rating != 5 {
		t.Errorf("teiländerung = %+v, %v", updated, err)
	}

	if _, err := db.sql.Exec(`INSERT INTO plan_entries (id, date, meal, position, kind, recipe_id)
		VALUES ('p1', '2026-10-10', 'dinner', 1, 'recipe', ?),
		       ('p2', '2026-10-12', 'dinner', 1, 'leftover', ?)`, got.ID, got.ID); err != nil {
		t.Fatal(err)
	}
	listed, err := db.GetRecipe(ctx, got.ID)
	if err != nil || listed.LastPlannedOn != "2026-10-10" {
		t.Errorf("lastPlannedOn = %q, %v", listed.LastPlannedOn, err)
	}
}

func TestRecipeOrganizationBounds(t *testing.T) {
	db := seededDB(t)
	tests := []struct {
		name, field string
		patch       RecipeOrganizationPatch
	}{
		{"gang", "course", RecipeOrganizationPatch{Course: Optional[string]{Set: true, Value: "Brunch"}}},
		{"küche", "cuisine", RecipeOrganizationPatch{Cuisine: Optional[string]{Set: true, Value: strings.Repeat("x", 51)}}},
		{"bewertung unten", "rating", RecipeOrganizationPatch{Rating: Optional[*int]{Set: true, Value: intPtr(0)}}},
		{"bewertung oben", "rating", RecipeOrganizationPatch{Rating: Optional[*int]{Set: true, Value: intPtr(6)}}},
		{"notizen", "notes", RecipeOrganizationPatch{Notes: Optional[string]{Set: true, Value: strings.Repeat("x", 2001)}}},
		{"zeit unten", "totalMinutes", RecipeOrganizationPatch{TotalMinutes: Optional[*int]{Set: true, Value: intPtr(0)}}},
		{"zeit oben", "totalMinutes", RecipeOrganizationPatch{TotalMinutes: Optional[*int]{Set: true, Value: intPtr(1441)}}},
		{"tag länge", "tags", RecipeOrganizationPatch{Tags: Optional[[]string]{Set: true, Value: []string{strings.Repeat("x", 31)}}}},
		{"tag anzahl", "tags", RecipeOrganizationPatch{Tags: Optional[[]string]{Set: true, Value: numberedTags(21)}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := db.UpdateRecipeOrganization(context.Background(), "linsensuppe", tt.patch)
			var invalid ErrInvalidOrganization
			if !errors.As(err, &invalid) || invalid.Field != tt.field {
				t.Errorf("err = %v, field = %q", err, invalid.Field)
			}
		})
	}
}

func numberedTags(count int) []string {
	tags := make([]string, count)
	for i := range tags {
		tags[i] = string(rune('A'+i)) + "tag"
	}
	return tags
}

func TestManageTags(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	for id, tags := range map[string][]string{
		"linsensuppe":     {"Vegetarisch", "Schnell"},
		"haehnchen-curry": {"veggie", "Schnell"},
	} {
		if _, err := db.UpdateRecipeOrganization(ctx, id, RecipeOrganizationPatch{Tags: Optional[[]string]{Set: true, Value: tags}}); err != nil {
			t.Fatal(err)
		}
	}
	tags, err := db.ListTags(ctx)
	if err != nil || len(tags) != 3 || tags[0] != (TagSummary{Name: "Schnell", Count: 2}) {
		t.Fatalf("tags = %+v, %v", tags, err)
	}
	if err := db.RenameTag(ctx, "veggie", "Vegetarisch"); err != nil {
		t.Fatal(err)
	}
	tags, _ = db.ListTags(ctx)
	if len(tags) != 2 || tags[1] != (TagSummary{Name: "Vegetarisch", Count: 2}) {
		t.Errorf("nach zusammenführen = %+v", tags)
	}
	if err := db.RenameTag(ctx, "vegetarisch", "vegetarisch"); err != nil {
		t.Fatal(err)
	}
	if recipe, _ := db.GetRecipe(ctx, "linsensuppe"); !slices.Contains(recipe.Tags, "vegetarisch") {
		t.Errorf("schreibweise nicht geändert: %v", recipe.Tags)
	}
	if err := db.DeleteTag(ctx, "schnell"); err != nil {
		t.Fatal(err)
	}
	if tags, _ := db.ListTags(ctx); len(tags) != 1 {
		t.Errorf("nach löschen = %+v", tags)
	}
	if err := db.DeleteTag(ctx, "fehlt"); !errors.Is(err, ErrNotFound) {
		t.Errorf("fehlender tag: %v", err)
	}
}

func TestImportFillsOnlyEmptyOrganization(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	first, _, err := db.SaveImported(ctx, "https://example.com/org", Recipe{
		Title: "Curry", Course: "Hauptgericht", Cuisine: "Indisch", Tags: []string{"Schnell"}, TotalMinutes: intPtr(45),
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.Course != "Hauptgericht" || first.Cuisine != "Indisch" || !slices.Equal(first.Tags, []string{"Schnell"}) || *first.TotalMinutes != 45 {
		t.Fatalf("vorbelegung = %+v", first)
	}
	again, _, err := db.SaveImported(ctx, "https://example.com/org", Recipe{
		Title: "Curry", Course: "Suppe", Cuisine: "Deutsch", Tags: []string{"Winter"}, TotalMinutes: intPtr(60),
	})
	if err != nil || again.Course != "Hauptgericht" || again.Cuisine != "Indisch" || !slices.Equal(again.Tags, []string{"Schnell"}) || *again.TotalMinutes != 45 {
		t.Errorf("erneuter import = %+v, %v", again, err)
	}
}
