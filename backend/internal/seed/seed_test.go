package seed

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

func TestRunSeedsOnceAndDoesNotDuplicate(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	ctx := context.Background()

	first, err := store.Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	seeded, err := Run(ctx, first)
	if err != nil || !seeded {
		t.Fatalf("erster Start: seeded=%v err=%v", seeded, err)
	}
	want, _ := Recipes()
	if count, _ := first.CountRecipes(ctx); count != len(want) || count == 0 {
		t.Fatalf("rezepte nach Seed: %d, erwartet %d", count, len(want))
	}
	first.Close()

	// Zweiter Start mit derselben Datenbank.
	second, err := store.Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	seeded, err = Run(ctx, second)
	if err != nil || seeded {
		t.Fatalf("zweiter Start: seeded=%v err=%v", seeded, err)
	}
	if count, _ := second.CountRecipes(ctx); count != len(want) {
		t.Errorf("rezepte nach zweitem Start: %d, erwartet %d", count, len(want))
	}

	curry, err := second.GetRecipe(ctx, "haehnchen-curry")
	if err != nil || curry.Title != "Hähnchen-Curry" || len(curry.Ingredients) == 0 {
		t.Errorf("haehnchen-curry = %+v, %v", curry, err)
	}
}

func TestEmbeddedRecipesMatchFrontendMock(t *testing.T) {
	frontend, err := os.ReadFile(filepath.Join("..", "..", "..", "frontend", "public", "mock", "recipes.json"))
	if err != nil {
		t.Skipf("frontend-Mockdaten nicht gefunden: %v", err)
	}
	if !bytes.Equal(frontend, recipesJSON) {
		t.Error("internal/seed/recipes.json weicht von frontend/public/mock/recipes.json ab – bitte Datei kopieren")
	}
}
