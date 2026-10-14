package store

import (
	"context"
	"errors"
	"io/fs"
	"path/filepath"
	"slices"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
)

func openTestDB(t *testing.T, path string) *DB {
	t.Helper()
	db, err := Open(context.Background(), path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func tempPath(t *testing.T) string {
	return filepath.Join(t.TempDir(), "nested", "test.db")
}

var testRecipes = []Recipe{
	{ID: "linsensuppe", Title: "Linsensuppe", Source: Source{Kind: SourceWeb, URL: "https://example.com/linsen"},
		Servings: intPtr(6), Ingredients: ingredient.ParseAll([]string{"250 g Linsen", "Karotten"})},
	{ID: "aepfel", Title: "Äpfel im Schlafrock", Source: Source{Kind: SourcePDF, PDFURL: "/mock/pdf/a.pdf"}},
	{ID: "haehnchen-curry", Title: "Hähnchen-Curry", Source: Source{Kind: SourceWeb, URL: "https://example.com/curry"},
		ImageURL: "/img.svg", Instructions: []string{"Kochen.", "Essen."}},
	{ID: "zucchini", Title: "zucchini-Puffer", Source: Source{Kind: SourcePDF, PDFURL: "/mock/pdf/z.pdf"}},
}

func seededDB(t *testing.T) *DB {
	t.Helper()
	db := openTestDB(t, tempPath(t))
	if err := db.InsertRecipes(context.Background(), "seed", testRecipes); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestOpenCreatesSchema(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()

	for _, table := range []string{"recipes", "plan_entries", "household_settings", "schema_migrations"} {
		var name string
		err := db.sql.QueryRowContext(ctx, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table).Scan(&name)
		if err != nil {
			t.Errorf("tabelle %s fehlt: %v", table, err)
		}
	}

	var mode string
	if err := db.sql.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&mode); err != nil || mode != "wal" {
		t.Errorf("journal_mode = %q, %v; erwartet wal", mode, err)
	}
	var timeout int
	if err := db.sql.QueryRowContext(ctx, "PRAGMA busy_timeout").Scan(&timeout); err != nil || timeout != 5000 {
		t.Errorf("busy_timeout = %d, %v; erwartet 5000", timeout, err)
	}
	if err := db.Ping(ctx); err != nil {
		t.Errorf("Ping: %v", err)
	}
}

func TestOpenTwiceAppliesMigrationsOnce(t *testing.T) {
	path := tempPath(t)
	first, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	first.Close()

	db := openTestDB(t, path)
	files, _ := fs.Glob(migrations, "migrations/*.sql")
	var count int
	if err := db.sql.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count); err != nil || count != len(files) {
		t.Errorf("schema_migrations enthält %d Einträge (%v), erwartet %d", count, err, len(files))
	}
}

func TestListRecipesSortedByTitle(t *testing.T) {
	db := seededDB(t)

	recipes, err := db.ListRecipes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var titles []string
	for _, r := range recipes {
		titles = append(titles, r.Title)
	}
	want := []string{"Äpfel im Schlafrock", "Hähnchen-Curry", "Linsensuppe", "zucchini-Puffer"}
	if !slices.Equal(titles, want) {
		t.Errorf("titel = %v, erwartet %v", titles, want)
	}
}

func TestListRecipesEmpty(t *testing.T) {
	db := openTestDB(t, tempPath(t))

	recipes, err := db.ListRecipes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if recipes == nil || len(recipes) != 0 {
		t.Errorf("erwartet leere, nicht-nil Liste, bekommen %#v", recipes)
	}
}

func TestGetRecipe(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()

	got, err := db.GetRecipe(ctx, "linsensuppe")
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Linsensuppe" || got.Source != (Source{Kind: SourceWeb, URL: "https://example.com/linsen"}) ||
		got.Servings == nil || *got.Servings != 6 || len(got.Ingredients) != 2 || got.Ingredients[0].Name != "Linsen" ||
		got.Ingredients[0].Text != "250 g Linsen" || got.Ingredients[0].Unit != "g" ||
		got.Instructions != nil || got.ImageURL != "" {
		t.Errorf("unerwartetes Rezept: %+v", got)
	}

	pdf, err := db.GetRecipe(ctx, "aepfel")
	if err != nil {
		t.Fatal(err)
	}
	if pdf.Source != (Source{Kind: SourcePDF, PDFURL: "/mock/pdf/a.pdf"}) {
		t.Errorf("quelle = %+v", pdf.Source)
	}

	if _, err := db.GetRecipe(ctx, "gibt-es-nicht"); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, erwartet ErrNotFound", err)
	}
}

func TestDataSurvivesReopen(t *testing.T) {
	path := tempPath(t)
	ctx := context.Background()

	first, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	if err := first.InsertRecipes(ctx, "seed", testRecipes); err != nil {
		t.Fatal(err)
	}
	planRecipe(t, first, "2026-09-30", "linsensuppe")
	first.Close()

	db := openTestDB(t, path)
	days := dinnerRecipes(t, db, "2026-09-28", "2026-10-04")
	if days["2026-09-30"] != "linsensuppe" {
		t.Errorf("zuordnung nach erneutem Öffnen verloren: %v", days)
	}
	if count, _ := db.CountRecipes(ctx); count != len(testRecipes) {
		t.Errorf("rezepte nach erneutem Öffnen: %d", count)
	}
}

func intPtr(n int) *int { return &n }
