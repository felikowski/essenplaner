package store

import (
	"context"
	"database/sql"
	"errors"
	"testing"
)

// openAtVersion legt eine Datenbank an, auf der nur die Migrationen bis einschließlich version gelaufen sind,
// und führt danach setup aus (etwa um Daten im alten Format einzufügen).
func openAtVersion(t *testing.T, version int, setup string) string {
	t.Helper()
	path := tempPath(t)
	db := openTestDB(t, path) // legt das Verzeichnis an
	db.Close()

	raw, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	defer raw.Close()
	rows, err := raw.Query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT IN ('schema_migrations', 'sqlite_sequence')")
	if err != nil {
		t.Fatal(err)
	}
	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		tables = append(tables, name)
	}
	rows.Close()
	for _, table := range tables {
		if _, err := raw.Exec("DROP TABLE " + table); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := raw.Exec("DELETE FROM schema_migrations"); err != nil {
		t.Fatal(err)
	}
	for v := 1; v <= version; v++ {
		files := map[int]string{1: "migrations/001_init.sql", 2: "migrations/002_web_import.sql"}
		script, err := migrations.ReadFile(files[v])
		if err != nil {
			t.Fatal(err)
		}
		if _, err := raw.Exec(string(script)); err != nil {
			t.Fatal(err)
		}
		if _, err := raw.Exec("INSERT INTO schema_migrations (version) VALUES (?)", v); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := raw.Exec(setup); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestMigrateRecipeEditorConvertsOldData(t *testing.T) {
	path := openAtVersion(t, 2, `
		INSERT INTO recipes (id, title, source_kind, source_ref, servings, ingredients_json, origin, canonical_url)
		VALUES ('curry', 'Curry', 'web', 'https://example.com/curry', '4 Portionen', '["600 g Hähnchen","1 Zwiebel, gehackt"]', 'web-import', 'https://example.com/curry'),
		       ('auflauf', 'Auflauf', 'pdf', '/a.pdf', 'eine Auflaufform', NULL, 'seed', NULL);
		UPDATE recipes SET available = 0 WHERE id = 'auflauf';
		INSERT INTO plan_days (date, recipe_id) VALUES ('2026-09-30', 'curry'), ('2026-10-01', 'auflauf');
	`)

	db := openTestDB(t, path)
	ctx := context.Background()

	curry, err := db.GetRecipe(ctx, "curry")
	if err != nil {
		t.Fatal(err)
	}
	if curry.Servings == nil || *curry.Servings != 4 {
		t.Errorf("portionen = %v", curry.Servings)
	}
	if len(curry.Ingredients) != 2 || curry.Ingredients[0].Text != "600 g Hähnchen" || curry.Ingredients[0].Unit != "g" ||
		curry.Ingredients[1].Note != "gehackt" {
		t.Errorf("zutaten = %+v", curry.Ingredients)
	}

	auflauf, err := db.GetRecipe(ctx, "auflauf")
	if err != nil {
		t.Fatal(err)
	}
	if auflauf.Servings != nil || auflauf.Available {
		t.Errorf("auflauf = %+v", auflauf)
	}

	// Die alten Tage sind Abendessen mit den Portionen des Rezepts (Migration 004).
	entries, err := db.Entries(ctx, "2026-09-28", "2026-10-04")
	if err != nil || len(entries["2026-09-30"]) != 1 || len(entries["2026-10-01"]) != 1 {
		t.Fatalf("plan = %v, %v", entries, err)
	}
	if e := entries["2026-09-30"][0]; e.Meal != "dinner" || e.Kind != KindRecipe || e.RecipeID != "curry" || e.Servings == nil || *e.Servings != 4 {
		t.Errorf("eintrag = %+v", e)
	}
	if e := entries["2026-10-01"][0]; e.RecipeID != "auflauf" || e.Servings != nil {
		t.Errorf("eintrag = %+v", e)
	}

	// Der Index für Duplikate besteht nach dem Umbau weiter.
	if _, err := db.sql.Exec(`INSERT INTO recipes (id, title, source_kind, origin, canonical_url)
		VALUES ('dup', 'Dup', 'web', 'web-import', 'https://example.com/curry')`); err == nil {
		t.Error("eindeutiger index auf canonical_url fehlt")
	}
	// Fremdschlüssel sind wieder aktiv.
	if _, err := db.sql.Exec("INSERT INTO plan_entries (id, date, meal, position, kind, recipe_id) VALUES ('x', '2026-10-02', 'dinner', 1, 'recipe', 'gibt-es-nicht')"); err == nil {
		t.Error("fremdschlüssel nicht aktiv")
	}
	// Eigene Rezepte sind jetzt erlaubt.
	if _, err := db.CreateRecipe(ctx, RecipeInput{Title: "Eigenes"}); err != nil {
		t.Errorf("eigenes rezept: %v", err)
	}
}

func TestFailingGoMigrationRollsBackSQL(t *testing.T) {
	goMigrations[999] = func(ctx context.Context, tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, "CREATE TABLE should_not_exist (id INTEGER)"); err != nil {
			return err
		}
		return errors.New("absichtlich fehlgeschlagen")
	}
	defer delete(goMigrations, 999)

	path := tempPath(t)
	if _, err := Open(context.Background(), path); err == nil {
		t.Fatal("Open sollte fehlschlagen")
	}
	delete(goMigrations, 999)

	db := openTestDB(t, path)
	var count int
	db.sql.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE name = 'should_not_exist'").Scan(&count)
	if count != 0 {
		t.Error("tabelle aus fehlgeschlagener migration existiert")
	}
	db.sql.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = 999").Scan(&count)
	if count != 0 {
		t.Error("fehlgeschlagene migration wurde als angewendet markiert")
	}
}

func TestUpdateRecipeTracksEditedFields(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	saved, _, err := db.SaveImported(ctx, "https://example.com/k", Recipe{
		Title: "Kürbissuppe", Servings: intPtr(4), Instructions: []string{"Kochen."},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Nur die Zutaten ändern sich; Portionen und Schritte bleiben gleich.
	if _, err := db.UpdateRecipe(ctx, saved.ID, RecipeInput{
		Title: "Kürbissuppe", Servings: intPtr(4), Ingredients: []string{"1 kg Kürbis"}, Instructions: []string{"Kochen."},
	}); err != nil {
		t.Fatal(err)
	}
	stored, _ := getRecipe(ctx, db.sql, saved.ID)
	if len(stored.edited) != 1 || stored.edited[0] != FieldIngredients {
		t.Errorf("edited = %v", stored.edited)
	}

	// Erneuter Import: Zutaten bleiben, Portionen und Schritte kommen aus der Quelle.
	again, _, err := db.SaveImported(ctx, "https://example.com/k", Recipe{
		Title: "Kürbissuppe", Servings: intPtr(6), Instructions: []string{"Neu kochen."},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(again.Ingredients) != 1 || again.Ingredients[0].Text != "1 kg Kürbis" ||
		*again.Servings != 6 || again.Instructions[0] != "Neu kochen." {
		t.Errorf("nach erneutem import: %+v", again)
	}

	// Titel nur bei eigenen Rezepten.
	if _, err := db.UpdateRecipe(ctx, saved.ID, RecipeInput{Title: "Anders"}); !errors.Is(err, ErrTitleNotEditable) {
		t.Errorf("titel bei import: %v", err)
	}
	if _, err := db.UpdateRecipe(ctx, "aepfel", RecipeInput{Title: "Birnen"}); !errors.Is(err, ErrTitleNotEditable) {
		t.Errorf("titel bei pdf: %v", err)
	}
	if _, err := db.UpdateRecipe(ctx, "gibt-es-nicht", RecipeInput{Title: "X"}); !errors.Is(err, ErrNotFound) {
		t.Errorf("unbekannt: %v", err)
	}
}

func TestCreateRecipe(t *testing.T) {
	db := seededDB(t)
	recipe, err := db.CreateRecipe(context.Background(), RecipeInput{
		Title: "Omas Gulasch", Servings: intPtr(4), Ingredients: []string{"1 kg Rindergulasch", "", "3 Zwiebeln"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(recipe.ID) != 14 || recipe.ID[:2] != "m-" || recipe.Source.Kind != SourceManual ||
		!recipe.Removable || !recipe.TitleEditable || len(recipe.Ingredients) != 2 || recipe.Ingredients[0].Unit != "kg" {
		t.Errorf("rezept = %+v", recipe)
	}
	stored, _ := getRecipe(context.Background(), db.sql, recipe.ID)
	if stored.origin != OriginManual {
		t.Errorf("origin = %s", stored.origin)
	}
}

func TestParseServings(t *testing.T) {
	tests := map[string]int{"4 Portionen": 4, "Makes 12": 12, "4 Portion(en)": 4, "8 Stück": 8, "eine Auflaufform": 0, "": 0, "120": 0}
	for text, want := range tests {
		got := ParseServings(text)
		if (want == 0) != (got == nil) || (got != nil && *got != want) {
			t.Errorf("ParseServings(%q) = %v, erwartet %d", text, got, want)
		}
	}
}
