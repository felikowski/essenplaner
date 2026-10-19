package store

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// rememberCategory legt eine eigene Kategorie an und merkt sie für den Artikel name.
func rememberCategory(t *testing.T, db *DB, name, category string) {
	t.Helper()
	ctx := context.Background()
	if err := db.CreateShoppingCategory(ctx, category); err != nil {
		t.Fatal(err)
	}
	mustAdd(t, db, name)
	list := shoppingList(t, db)
	item := itemNamed(t, list, name)
	id := categoryID(t, list, category)
	if err := db.UpdateShoppingItem(ctx, item.ID, ShoppingItemPatch{CategoryID: &id}, Actor{}); err != nil {
		t.Fatal(err)
	}
	if err := db.DeleteShoppingItem(ctx, item.ID); err != nil {
		t.Fatal(err)
	}
}

func TestPreviewShoppingLines(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t, tempPath(t))
	rememberCategory(t, db, "Feta", "Käsetheke")
	mustAdd(t, db, "Bier")
	before, _ := db.ShoppingVersion(ctx)

	previews, err := db.PreviewShoppingLines(ctx, []string{"2 Gurken", " 200 g  Feta ", "Bier", "1 Gurken"})
	if err != nil {
		t.Fatal(err)
	}
	if len(previews) != 4 {
		t.Fatalf("vorschau = %+v", previews)
	}
	cucumber, feta, beer, again := previews[0], previews[1], previews[2], previews[3]
	if cucumber.Name != "Gurken" || cucumber.Category != "Obst & Gemüse" || cucumber.MergesInto != nil {
		t.Errorf("Gurken = %+v", cucumber)
	}
	if feta.Text != "200 g Feta" || feta.Category != "Käsetheke" || feta.MergesInto != nil {
		t.Errorf("Feta = %+v", feta)
	}
	if beer.Category != "Getränke" || beer.MergesInto == nil || *beer.MergesInto != "Bier" {
		t.Errorf("Bier = %+v", beer)
	}
	if again.MergesInto == nil || *again.MergesInto != "Gurken" || again.Category != "Obst & Gemüse" {
		t.Errorf("zweite Gurken = %+v", again)
	}
	if after, _ := db.ShoppingVersion(ctx); after != before {
		t.Errorf("vorschau hat geschrieben: version %d → %d", before, after)
	}
	if n := len(shoppingList(t, db).Items); n != 1 {
		t.Errorf("artikel nach der Vorschau = %d", n)
	}
}

func TestPreviewFollowsAlias(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t, tempPath(t))
	mustAdd(t, db, "1 Zwiebel", "3 Zwiebeln")
	list := shoppingList(t, db)
	if err := db.MergeShoppingItem(ctx, itemNamed(t, list, "Zwiebel").ID, itemNamed(t, list, "Zwiebeln").ID); err != nil {
		t.Fatal(err)
	}
	previews, err := db.PreviewShoppingLines(ctx, []string{"1 Zwiebel"})
	if err != nil {
		t.Fatal(err)
	}
	if p := previews[0]; p.Name != "Zwiebeln" || p.MergesInto == nil || *p.MergesInto != "Zwiebeln" {
		t.Errorf("vorschau = %+v", p)
	}
}

func TestAddShoppingItems(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t, tempPath(t))
	rememberCategory(t, db, "Feta", "Käsetheke")
	mustAdd(t, db, "1 Bier")
	before, _ := db.ShoppingVersion(ctx)

	if err := db.AddShoppingItems(ctx, []string{"2 Gurken", "Feta", "2 Bier", "Spülmittel"}, Actor{}); err != nil {
		t.Fatal(err)
	}
	list := shoppingList(t, db)
	if after := list.Version; after != before+1 {
		t.Errorf("version %d → %d, erwartet genau eine Erhöhung", before, after)
	}
	if len(list.Items) != 4 {
		t.Fatalf("artikel = %+v", list.Items)
	}
	if got := itemNamed(t, list, "Bier").Display; got != "3" {
		t.Errorf("Bier = %q, erwartet zusammengefasst", got)
	}
	if got := categoryName(list, itemNamed(t, list, "Feta").CategoryID); got != "Käsetheke" {
		t.Errorf("Feta in %q", got)
	}
	if got := itemNamed(t, list, "Gurken").Sources[0].Kind; got != PartManual {
		t.Errorf("herkunft = %q", got)
	}
}

func TestAddShoppingItemsAllOrNothing(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t, tempPath(t))
	before, _ := db.ShoppingVersion(ctx)

	tooMany := make([]string, MaxShoppingLines+1)
	for i := range tooMany {
		tooMany[i] = "Apfel"
	}
	for name, texts := range map[string][]string{
		"leere zeile":  {"Gurken", "  ", "Feta"},
		"zu lang":      {"Gurken", strings.Repeat("x", MaxShoppingText+1)},
		"keine zeilen": {},
		"zu viele":     tooMany,
	} {
		var invalid ErrInvalidShopping
		if err := db.AddShoppingItems(ctx, texts, Actor{}); !errors.As(err, &invalid) {
			t.Errorf("%s: err = %v", name, err)
		}
		if _, err := db.PreviewShoppingLines(ctx, texts); !errors.As(err, &invalid) {
			t.Errorf("%s (vorschau): err = %v", name, err)
		}
	}
	if err := db.AddShoppingItems(ctx, tooMany[:MaxShoppingLines], Actor{}); err != nil {
		t.Errorf("genau %d zeilen: %v", MaxShoppingLines, err)
	}
	list := shoppingList(t, db)
	if list.Version != before+1 || len(list.Items) != 1 {
		t.Errorf("version %d → %d, artikel %+v", before, list.Version, list.Items)
	}
	var invalid ErrInvalidShopping
	if err := db.AddShoppingItems(ctx, []string{"Gurken", ""}, Actor{}); !errors.As(err, &invalid) || !strings.HasPrefix(invalid.Reason, "Zeile 2:") {
		t.Errorf("meldung = %v", err)
	}
}
