package store

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestSaveImportedCreatesAndDeduplicates(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	recipe := Recipe{
		Title: "Kürbissuppe", ImageURL: "https://img.example.com/k.jpg", Servings: "4 Portionen",
		Ingredients: []string{"1 kg Kürbis"}, Instructions: []string{"Kochen."},
	}

	saved, created, err := db.SaveImported(ctx, "https://example.com/kuerbis", recipe)
	if err != nil || !created {
		t.Fatalf("erster import: created=%v err=%v", created, err)
	}
	if !strings.HasPrefix(saved.ID, "w-") || saved.Source.URL != "https://example.com/kuerbis" ||
		!saved.Available || !saved.Removable || saved.Ingredients[0] != "1 kg Kürbis" {
		t.Errorf("gespeichert: %+v", saved)
	}

	again, created, err := db.SaveImported(ctx, "https://example.com/kuerbis", Recipe{Title: "Anders"})
	if err != nil || created || again.ID != saved.ID || again.Title != "Kürbissuppe" {
		t.Errorf("duplikat: %+v created=%v err=%v", again, created, err)
	}

	found, err := db.FindImported(ctx, "https://example.com/kuerbis")
	if err != nil || found.ID != saved.ID {
		t.Errorf("FindImported: %+v %v", found, err)
	}
	if _, err := db.FindImported(ctx, "https://example.com/anderes"); !errors.Is(err, ErrNotFound) {
		t.Errorf("unbekannte adresse: %v", err)
	}
}

func TestRemoveRecipeHidesButKeepsPlans(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	saved, _, err := db.SaveImported(ctx, "https://example.com/a", Recipe{Title: "Aaa"})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.SetDay(ctx, "2026-09-30", &saved.ID); err != nil {
		t.Fatal(err)
	}

	if err := db.RemoveRecipe(ctx, saved.ID); err != nil {
		t.Fatal(err)
	}
	list, _ := db.ListRecipes(ctx)
	for _, r := range list {
		if r.ID == saved.ID {
			t.Error("entferntes rezept steht noch in der liste")
		}
	}
	removed, err := db.GetRecipe(ctx, saved.ID)
	if err != nil || removed.Available || removed.Removable {
		t.Errorf("entferntes rezept: %+v %v", removed, err)
	}
	days, _ := db.PlannedDays(ctx, "2026-09-28", "2026-10-04")
	if days["2026-09-30"] != saved.ID {
		t.Errorf("plan verloren: %v", days)
	}

	// Nicht mehr verfügbare Rezepte lassen sich nicht neu zuordnen.
	if err := db.SetDay(ctx, "2026-10-01", &saved.ID); !errors.Is(err, ErrUnknownRecipe) {
		t.Errorf("zuordnen eines entfernten rezepts: %v", err)
	}

	// Erneuter Import macht es wieder verfügbar.
	again, created, err := db.SaveImported(ctx, "https://example.com/a", Recipe{Title: "Aaa"})
	if err != nil || created || !again.Available || again.ID != saved.ID {
		t.Errorf("reaktivierung: %+v created=%v err=%v", again, created, err)
	}
}

func TestRemoveRecipeRejectsOtherOrigins(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	if err := db.RemoveRecipe(ctx, "aepfel"); !errors.Is(err, ErrNotRemovable) {
		t.Errorf("seed-rezept: %v", err)
	}
	if err := db.RemoveRecipe(ctx, "gibt-es-nicht"); !errors.Is(err, ErrNotFound) {
		t.Errorf("unbekannt: %v", err)
	}
	seedRecipe, _ := db.GetRecipe(ctx, "aepfel")
	if !seedRecipe.Available || seedRecipe.Removable {
		t.Errorf("seed-rezept: %+v", seedRecipe)
	}
}
