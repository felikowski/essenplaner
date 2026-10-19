package store

import (
	"context"
	"database/sql"
	"slices"
	"testing"
)

var (
	felix = Actor{Subject: "auth0|felix", Name: "felix"}
	linh  = Actor{Subject: "auth0|linh", Name: "linh"}
)

func addedBy(item ShoppingItem) []string {
	names := []string{}
	for _, s := range item.Sources {
		names = append(names, s.AddedBy)
	}
	return names
}

func TestShoppingAttributionPerPath(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	planRecipe(t, db, "2026-10-02", "linsensuppe")
	if _, err := db.ImportFromPlan(ctx, "2026-10-01", "2026-10-07", felix); err != nil {
		t.Fatal(err)
	}
	if err := db.AddShoppingItem(ctx, "Feta", linh); err != nil {
		t.Fatal(err)
	}
	if err := db.AddShoppingItems(ctx, []string{"Milch"}, felix); err != nil {
		t.Fatal(err)
	}
	if err := db.AddShoppingItem(ctx, "1 l Milch", linh); err != nil {
		t.Fatal(err)
	}
	if err := db.CreateStaple(ctx, "Kaffee"); err != nil {
		t.Fatal(err)
	}
	staples, err := db.Staples(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AddStaplesToList(ctx, []string{staples[0].ID}, linh); err != nil {
		t.Fatal(err)
	}

	list := shoppingList(t, db)
	for name, want := range map[string][]string{
		"Linsen": {"felix"},
		"Feta":   {"linh"},
		"Milch":  {"felix", "linh"},
		"Kaffee": {"linh"},
	} {
		if got := addedBy(itemNamed(t, list, name)); !slices.Equal(got, want) {
			t.Errorf("%s: addedBy = %v, want %v", name, got, want)
		}
	}

	// Eine Menge von Hand ersetzt die Anteile und gehört dem Bearbeiter.
	linsen := itemNamed(t, list, "Linsen")
	amount := "500 g"
	if err := db.UpdateShoppingItem(ctx, linsen.ID, ShoppingItemPatch{Quantity: &amount}, linh); err != nil {
		t.Fatal(err)
	}
	linsen = itemNamed(t, shoppingList(t, db), "Linsen")
	if got := addedBy(linsen); !slices.Equal(got, []string{"linh"}) || linsen.Sources[0].Kind != PartManual {
		t.Errorf("nach Menge von Hand: %+v", linsen.Sources)
	}

	// Zusammenführen behält die Personen.
	list = shoppingList(t, db)
	if err := db.MergeShoppingItem(ctx, itemNamed(t, list, "Feta").ID, itemNamed(t, list, "Milch").ID); err != nil {
		t.Fatal(err)
	}
	if got := addedBy(itemNamed(t, shoppingList(t, db), "Milch")); !slices.Equal(got, []string{"linh", "felix", "linh"}) { // nach Reihenfolge des Hinzufügens
		t.Errorf("nach Zusammenführen: %v", got)
	}
}

func TestShoppingSourceDisplay(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()
	mustAdd(t, db, "2 EL Butter", "1 EL Butter", "Salz")
	// Ein Anteil aus dem Plan, direkt eingefügt, damit kein Rezept nötig ist.
	butter := itemNamed(t, shoppingList(t, db), "Butter")
	err := db.shoppingTx(ctx, func(tx *sql.Tx) error {
		q := 250.0
		return insertPart(ctx, tx, butter.ID, part{quantity: &q, unit: "g", kind: PartPlan, text: "250 g Butter"})
	})
	if err != nil {
		t.Fatal(err)
	}
	list := shoppingList(t, db)
	butter = itemNamed(t, list, "Butter")
	if butter.SourceDisplay[PartPlan] != "250 g" || butter.SourceDisplay[PartManual] != "3 EL" || len(butter.SourceDisplay) != 2 {
		t.Errorf("sourceDisplay = %v", butter.SourceDisplay)
	}
	if salz := itemNamed(t, list, "Salz"); salz.SourceDisplay[PartManual] != "" {
		t.Errorf("Salz ohne Menge: %v", salz.SourceDisplay)
	}
}

func TestShoppingAttributionMigration(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()
	mustAdd(t, db, "Feta")
	item := itemNamed(t, shoppingList(t, db), "Feta")
	// So schreibt eine Version ohne Migration 009 (Rollback): ohne die neuen Spalten.
	if _, err := db.sql.ExecContext(ctx,
		"INSERT INTO shopping_item_parts (item_id, quantity, unit, source_kind, text) VALUES (?, NULL, '', 'manual', 'Feta')", item.ID); err != nil {
		t.Fatal(err)
	}
	item = itemNamed(t, shoppingList(t, db), "Feta")
	if got := addedBy(item); !slices.Equal(got, []string{"", ""}) {
		t.Errorf("ohne person: %v", got)
	}
}
