package store

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

// planRecipe legt ein Abendessen mit einem Rezept an.
func planRecipe(t *testing.T, db *DB, date, recipeID string) Entry {
	t.Helper()
	e, err := db.CreateEntry(context.Background(), EntryInput{Date: date, Meal: "dinner", Kind: KindRecipe, RecipeID: recipeID})
	if err != nil {
		t.Fatalf("einplanen von %s am %s: %v", recipeID, date, err)
	}
	return e
}

// dinnerRecipes liefert je Datum die Rezept-ID des ersten Abendessens.
func dinnerRecipes(t *testing.T, db *DB, from, to string) map[string]string {
	t.Helper()
	entries, err := db.Entries(context.Background(), from, to)
	if err != nil {
		t.Fatal(err)
	}
	days := map[string]string{}
	for date, list := range entries {
		for _, e := range list {
			if e.Meal == "dinner" && e.RecipeID != "" && days[date] == "" {
				days[date] = e.RecipeID
			}
		}
	}
	return days
}

func entriesOn(t *testing.T, db *DB, date string) []Entry {
	t.Helper()
	entries, err := db.Entries(context.Background(), date, date)
	if err != nil {
		t.Fatal(err)
	}
	return entries[date]
}

func TestCreateEntriesOfAllKinds(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()

	curry := planRecipe(t, db, "2026-09-30", "linsensuppe")
	if curry.Servings == nil || *curry.Servings != 6 || curry.Position != 1 {
		t.Errorf("rezepteintrag = %+v", curry)
	}
	side, _ := db.CreateEntry(ctx, EntryInput{Date: "2026-09-30", Meal: "dinner", Kind: KindRecipe, RecipeID: "aepfel", Servings: intPtr(2)})
	note, err := db.CreateEntry(ctx, EntryInput{Date: "2026-09-30", Meal: "dinner", Kind: KindNote, Text: "  Oma kommt "})
	if err != nil {
		t.Fatal(err)
	}
	item, _ := db.CreateEntry(ctx, EntryInput{Date: "2026-09-30", Meal: "dinner", Kind: KindItem, Text: "1 Baguette"})
	lunch, _ := db.CreateEntry(ctx, EntryInput{Date: "2026-09-30", Meal: "lunch", Kind: KindNote, Text: "Kantine"})

	got := entriesOn(t, db, "2026-09-30")
	ids := []string{}
	for _, e := range got {
		ids = append(ids, e.ID)
	}
	want := []string{lunch.ID, curry.ID, side.ID, note.ID, item.ID}
	if len(ids) != len(want) {
		t.Fatalf("einträge = %+v", got)
	}
	for i := range want {
		if ids[i] != want[i] {
			t.Errorf("reihenfolge = %v, erwartet %v", ids, want)
			break
		}
	}
	if got[2].Servings == nil || *got[2].Servings != 2 || got[3].Text != "Oma kommt" || got[4].Kind != KindItem {
		t.Errorf("einträge = %+v", got)
	}
}

func TestCreateEntryRejectsInvalidReferences(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	note, _ := db.CreateEntry(ctx, EntryInput{Date: "2026-09-30", Meal: "dinner", Kind: KindNote, Text: "x"})

	tests := []EntryInput{
		{Date: "2026-09-30", Meal: "dinner", Kind: KindRecipe, RecipeID: "gibt-es-nicht"},
		{Date: "2026-09-30", Meal: "dinner", Kind: KindNote, Text: "   "},
		{Date: "2026-09-30", Meal: "dinner", Kind: KindItem, Text: string(make([]rune, 201))},
		{Date: "2026-10-01", Meal: "dinner", Kind: KindLeftover, LeftoverOf: note.ID},
		{Date: "2026-10-01", Meal: "dinner", Kind: KindLeftover, LeftoverOf: "gibt-es-nicht"},
	}
	for _, input := range tests {
		var invalid ErrInvalidEntry
		if _, err := db.CreateEntry(ctx, input); !errors.As(err, &invalid) {
			t.Errorf("CreateEntry(%+v) = %v, erwartet ErrInvalidEntry", input, err)
		}
	}
	if n := len(entriesOn(t, db, "2026-09-30")); n != 1 {
		t.Errorf("%d einträge, erwartet 1", n)
	}
}

func TestLeftoversFollowTheirOriginal(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	original := planRecipe(t, db, "2026-09-28", "haehnchen-curry")

	leftover, err := db.CreateEntry(ctx, EntryInput{Date: "2026-09-29", Meal: "lunch", Kind: KindLeftover, LeftoverOf: original.ID})
	if err != nil {
		t.Fatal(err)
	}
	if leftover.RecipeID != "haehnchen-curry" || leftover.LeftoverOf.ID != original.ID || leftover.LeftoverOf.Date != "2026-09-28" || leftover.Servings != nil {
		t.Errorf("reste = %+v", leftover)
	}
	if got := entriesOn(t, db, "2026-09-29")[0]; got.LeftoverOf == nil || got.LeftoverOf.Date != "2026-09-28" {
		t.Errorf("gelesene reste = %+v", got)
	}

	dates, err := db.DeleteEntry(ctx, original.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(dates) != 2 {
		t.Errorf("betroffene tage = %v", dates)
	}
	note := entriesOn(t, db, "2026-09-29")[0]
	if note.Kind != KindNote || note.Text != "Reste: Hähnchen-Curry" || note.RecipeID != "" || note.LeftoverOf != nil {
		t.Errorf("reste nach löschen des originals = %+v", note)
	}
}

func TestUpdateEntryMovesAndChangesServings(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	planRecipe(t, db, "2026-10-01", "aepfel")
	e := planRecipe(t, db, "2026-09-30", "linsensuppe")

	date, meal := "2026-10-01", "dinner"
	before, after, err := db.UpdateEntry(ctx, e.ID, EntryPatch{Date: &date, Meal: &meal, SetServings: true, Servings: intPtr(8)})
	if err != nil {
		t.Fatal(err)
	}
	if before.Date != "2026-09-30" || after.Date != "2026-10-01" || after.Position != 2 || *after.Servings != 8 {
		t.Errorf("vorher %+v, nachher %+v", before, after)
	}
	if len(entriesOn(t, db, "2026-09-30")) != 0 || len(entriesOn(t, db, "2026-10-01")) != 2 {
		t.Error("eintrag wurde nicht verschoben")
	}

	// Portionen entfernen und Text nur bei Notizen.
	if _, after, _ := db.UpdateEntry(ctx, e.ID, EntryPatch{SetServings: true}); after.Servings != nil {
		t.Errorf("portionen nicht entfernt: %+v", after)
	}
	text := "Neu"
	var invalid ErrInvalidEntry
	if _, _, err := db.UpdateEntry(ctx, e.ID, EntryPatch{Text: &text}); !errors.As(err, &invalid) {
		t.Errorf("text bei rezept: %v", err)
	}
	note, _ := db.CreateEntry(ctx, EntryInput{Date: "2026-10-01", Meal: "lunch", Kind: KindNote, Text: "Alt"})
	if _, _, err := db.UpdateEntry(ctx, note.ID, EntryPatch{SetServings: true, Servings: intPtr(2)}); !errors.As(err, &invalid) {
		t.Errorf("portionen bei notiz: %v", err)
	}
	if _, after, _ := db.UpdateEntry(ctx, note.ID, EntryPatch{Text: &text}); after.Text != "Neu" {
		t.Errorf("text = %q", after.Text)
	}
	if _, _, err := db.UpdateEntry(ctx, "gibt-es-nicht", EntryPatch{}); !errors.Is(err, ErrNotFound) {
		t.Errorf("unbekannt: %v", err)
	}
}

var week40 = []string{"2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"}
var week42 = []string{"2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"}

func TestCopyWeek(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	monday := planRecipe(t, db, "2026-09-28", "haehnchen-curry")
	db.CreateEntry(ctx, EntryInput{Date: "2026-09-29", Meal: "lunch", Kind: KindLeftover, LeftoverOf: monday.ID})
	db.CreateEntry(ctx, EntryInput{Date: "2026-10-03", Meal: "dinner", Kind: KindNote, Text: "Essen bei Oma"})
	removed, _, _ := db.SaveImported(ctx, "https://example.com/weg", Recipe{Title: "Weg"})
	planRecipe(t, db, "2026-10-02", removed.ID)
	db.RemoveRecipe(ctx, removed.ID)

	skipped, err := db.CopyWeek(ctx, week40, week42, false)
	if err != nil {
		t.Fatal(err)
	}
	if skipped != 1 {
		t.Errorf("übersprungen = %d, erwartet 1", skipped)
	}
	copiedMonday := entriesOn(t, db, "2026-10-12")
	copiedLeftover := entriesOn(t, db, "2026-10-13")
	if len(copiedMonday) != 1 || copiedMonday[0].RecipeID != "haehnchen-curry" || copiedMonday[0].ID == monday.ID {
		t.Fatalf("montag = %+v", copiedMonday)
	}
	if len(copiedLeftover) != 1 || copiedLeftover[0].LeftoverOf.ID != copiedMonday[0].ID || copiedLeftover[0].LeftoverOf.Date != "2026-10-12" {
		t.Errorf("reste verweisen nicht auf die kopie: %+v", copiedLeftover)
	}
	if got := entriesOn(t, db, "2026-10-17"); len(got) != 1 || got[0].Text != "Essen bei Oma" {
		t.Errorf("samstag = %+v", got)
	}
	if got := entriesOn(t, db, "2026-10-16"); len(got) != 0 {
		t.Errorf("entferntes rezept wurde kopiert: %+v", got)
	}

	// Ergänzen hängt an, Ersetzen leert die Zielwoche vorher.
	db.CopyWeek(ctx, week40, week42, false)
	if n := len(entriesOn(t, db, "2026-10-12")); n != 2 {
		t.Errorf("nach ergänzen %d einträge am montag, erwartet 2", n)
	}
	db.CopyWeek(ctx, week40, week42, true)
	if n := len(entriesOn(t, db, "2026-10-12")); n != 1 {
		t.Errorf("nach ersetzen %d einträge am montag, erwartet 1", n)
	}
}

func TestRecipeHistory(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	if dates, err := db.RecipeHistory(ctx, "linsensuppe"); err != nil || len(dates) != 0 {
		t.Errorf("leerer verlauf = %v, %v", dates, err)
	}
	first := planRecipe(t, db, "2026-10-02", "linsensuppe")
	planRecipe(t, db, "2026-10-16", "linsensuppe")
	db.CreateEntry(ctx, EntryInput{Date: "2026-10-03", Meal: "lunch", Kind: KindLeftover, LeftoverOf: first.ID})

	dates, err := db.RecipeHistory(ctx, "linsensuppe")
	if err != nil || len(dates) != 2 || dates[0] != "2026-10-16" || dates[1] != "2026-10-02" {
		t.Errorf("verlauf = %v, %v", dates, err)
	}
}

func TestSettings(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()

	settings, err := db.Settings(ctx)
	if err != nil || len(settings["visibleMeals"].([]string)) != 1 || settings["visibleMeals"].([]string)[0] != "dinner" {
		t.Fatalf("standard = %v, %v", settings, err)
	}

	updated, err := db.UpdateSettings(ctx, map[string]json.RawMessage{"visibleMeals": []byte(`["dinner","lunch","lunch"]`)})
	if err != nil {
		t.Fatal(err)
	}
	if meals := updated["visibleMeals"].([]string); len(meals) != 2 || meals[0] != "lunch" || meals[1] != "dinner" {
		t.Errorf("mahlzeiten = %v", meals)
	}

	for _, raw := range []string{`[]`, `["brunch"]`, `"dinner"`} {
		var invalid ErrInvalidSetting
		if _, err := db.UpdateSettings(ctx, map[string]json.RawMessage{"visibleMeals": []byte(raw)}); !errors.As(err, &invalid) {
			t.Errorf("%s: %v", raw, err)
		}
	}
	var invalid ErrInvalidSetting
	if _, err := db.UpdateSettings(ctx, map[string]json.RawMessage{"unbekannt": []byte(`1`)}); !errors.As(err, &invalid) {
		t.Errorf("unbekannter schlüssel: %v", err)
	}
	if settings, _ := db.Settings(ctx); len(settings["visibleMeals"].([]string)) != 2 {
		t.Errorf("ungültige werte haben gespeicherte überschrieben: %v", settings)
	}
}
