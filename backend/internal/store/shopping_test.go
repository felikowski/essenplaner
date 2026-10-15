package store

import (
	"context"
	"errors"
	"testing"
)

func shoppingList(t *testing.T, db *DB) ShoppingList {
	t.Helper()
	list, err := db.ShoppingList(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return list
}

// itemNamed liefert den ersten Artikel mit dem Namen (offen vor erledigt, wie sortiert).
func itemNamed(t *testing.T, list ShoppingList, name string) ShoppingItem {
	t.Helper()
	for _, item := range list.Items {
		if item.Name == name {
			return item
		}
	}
	t.Fatalf("artikel %q fehlt in %+v", name, list.Items)
	return ShoppingItem{}
}

func categoryName(list ShoppingList, id string) string {
	for _, c := range list.Categories {
		if c.ID == id {
			return c.Name
		}
	}
	return ""
}

func categoryID(t *testing.T, list ShoppingList, name string) string {
	t.Helper()
	for _, c := range list.Categories {
		if c.Name == name {
			return c.ID
		}
	}
	t.Fatalf("kategorie %q fehlt", name)
	return ""
}

func mustAdd(t *testing.T, db *DB, texts ...string) {
	t.Helper()
	for _, text := range texts {
		if err := db.AddShoppingItem(context.Background(), text); err != nil {
			t.Fatalf("%q hinzufügen: %v", text, err)
		}
	}
}

func TestShoppingCategoriesSeeded(t *testing.T) {
	list := shoppingList(t, openTestDB(t, tempPath(t)))
	if len(list.Categories) != 14 || list.Categories[0].Name != "Obst & Gemüse" || list.Categories[13].Name != "Sonstiges" {
		t.Fatalf("kategorien = %+v", list.Categories)
	}
	if list.Categories[13].Removable || !list.Categories[0].Removable {
		t.Errorf("nur „Sonstiges“ ist nicht löschbar: %+v", list.Categories)
	}
	if len(list.Items) != 0 || len(list.Stores) != 0 || list.Version < 1 {
		t.Errorf("leere liste = %+v", list)
	}
}

func TestAddShoppingItemsCombines(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	mustAdd(t, db, "500 g Mehl", "200 g mehl", "800 g Kartoffeln", "1 kg Kartoffeln", "250 g Butter", "2 EL Butter",
		"2 Packungen Kaffee", "Salz", "Zucchini")

	list := shoppingList(t, db)
	for name, want := range map[string]string{"Mehl": "700 g", "Kartoffeln": "1,8 kg", "Butter": "250 g + 2 EL", "Kaffee": "2 Pck.", "Salz": ""} {
		if got := itemNamed(t, list, name).Display; got != want {
			t.Errorf("%s = %q, erwartet %q", name, got, want)
		}
	}
	if len(list.Items) != 6 {
		t.Errorf("artikel = %d, erwartet 6", len(list.Items))
	}
	if got := categoryName(list, itemNamed(t, list, "Zucchini").CategoryID); got != "Obst & Gemüse" {
		t.Errorf("Zucchini unter %q", got)
	}
	if got := categoryName(list, itemNamed(t, list, "Kaffee").CategoryID); got != "Getränke" {
		t.Errorf("Kaffee unter %q", got)
	}
	// Sortierung nach Kategorie-Reihenfolge: Obst & Gemüse vor Milchprodukte vor Backen.
	if list.Items[0].Name != "Kartoffeln" || list.Items[1].Name != "Zucchini" || list.Items[2].Name != "Butter" {
		t.Errorf("reihenfolge = %v", names(list))
	}
	if err := db.AddShoppingItem(context.Background(), "   "); !isInvalidShopping(err) {
		t.Errorf("leerer artikel: %v", err)
	}
}

func names(list ShoppingList) []string {
	var result []string
	for _, item := range list.Items {
		result = append(result, item.Name)
	}
	return result
}

func isInvalidShopping(err error) bool {
	var invalid ErrInvalidShopping
	return errors.As(err, &invalid)
}

func TestCheckClearAndVersion(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()
	mustAdd(t, db, "Milch", "Butter", "1 l Hafermilch")
	before, _ := db.ShoppingVersion(ctx)

	milk := itemNamed(t, shoppingList(t, db), "Milch")
	if err := db.SetShoppingItemChecked(ctx, milk.ID, true); err != nil {
		t.Fatal(err)
	}
	// Idempotent: zweimal abhaken ändert nichts am Ergebnis.
	if err := db.SetShoppingItemChecked(ctx, milk.ID, true); err != nil {
		t.Fatal(err)
	}
	list := shoppingList(t, db)
	if after := list.Version; after <= before {
		t.Errorf("version %d → %d", before, after)
	}
	last := list.Items[len(list.Items)-1]
	if last.Name != "Milch" || !last.Checked {
		t.Errorf("abgehakte Milch muss am Ende ihrer Kategorie stehen: %v", names(list))
	}

	// Neue Milch hängt sich nicht an den erledigten Artikel.
	mustAdd(t, db, "Milch")
	if got := len(shoppingList(t, db).Items); got != 4 {
		t.Errorf("artikel = %d, erwartet 4", got)
	}

	if err := db.ClearCheckedShoppingItems(ctx); err != nil {
		t.Fatal(err)
	}
	list = shoppingList(t, db)
	if len(list.Items) != 3 {
		t.Errorf("nach dem Aufräumen: %v", names(list))
	}
	for _, item := range list.Items {
		if item.Checked {
			t.Errorf("%s ist noch abgehakt", item.Name)
		}
	}
	if err := db.SetShoppingItemChecked(ctx, "s-fehlt", true); !errors.Is(err, ErrNotFound) {
		t.Errorf("unbekannter artikel: %v", err)
	}
	if err := db.DeleteShoppingItem(ctx, list.Items[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := db.DeleteShoppingItem(ctx, list.Items[0].ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("zweimal löschen: %v", err)
	}
}

func TestImportFromPlan(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	soup, err := db.CreateEntry(ctx, EntryInput{Date: "2026-10-02", Meal: "dinner", Kind: KindRecipe, RecipeID: "linsensuppe", Servings: intPtr(8)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateEntry(ctx, EntryInput{Date: "2026-10-03", Meal: "dinner", Kind: KindItem, Text: "1 Baguette"}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateEntry(ctx, EntryInput{Date: "2026-10-03", Meal: "lunch", Kind: KindLeftover, LeftoverOf: soup.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateEntry(ctx, EntryInput{Date: "2026-10-03", Meal: "dinner", Kind: KindNote, Text: "Oma kommt"}); err != nil {
		t.Fatal(err)
	}
	planRecipe(t, db, "2026-10-04", "aepfel")      // ohne Zutaten
	planRecipe(t, db, "2026-10-20", "linsensuppe") // außerhalb des Zeitraums

	without, err := db.ImportFromPlan(ctx, "2026-10-01", "2026-10-07")
	if err != nil {
		t.Fatal(err)
	}
	if len(without) != 1 || without[0].Title != "Äpfel im Schlafrock" {
		t.Errorf("ohne zutaten = %+v", without)
	}
	list := shoppingList(t, db)
	// Faktor 8/6, Reste und Notiz übersprungen, Zeitraum eingehalten.
	if got := itemNamed(t, list, "Linsen").Display; got != "333 g" {
		t.Errorf("Linsen = %q", got)
	}
	if got := itemNamed(t, list, "Baguette").Display; got != "1" {
		t.Errorf("Baguette = %q", got)
	}
	if len(list.Items) != 3 {
		t.Errorf("artikel = %v", names(list))
	}
	source := itemNamed(t, list, "Linsen").Sources[0]
	if source.RecipeTitle != "Linsensuppe" || source.Date != "2026-10-02" || source.Amount != "333 g" || source.Kind != PartPlan {
		t.Errorf("herkunft = %+v", source)
	}

	// Zweite Übernahme: nur das neu geplante Rezept kommt hinzu.
	planRecipe(t, db, "2026-10-05", "linsensuppe")
	if _, err := db.ImportFromPlan(ctx, "2026-10-01", "2026-10-07"); err != nil {
		t.Fatal(err)
	}
	list = shoppingList(t, db)
	if got := itemNamed(t, list, "Linsen").Display; got != "583 g" {
		t.Errorf("Linsen nach zweiter Übernahme = %q", got)
	}
	if got := len(itemNamed(t, list, "Baguette").Sources); got != 1 {
		t.Errorf("Baguette doppelt übernommen: %d", got)
	}

	// Auch nach dem Löschen bleibt ein Eintrag übernommen.
	if err := db.DeleteShoppingItem(ctx, itemNamed(t, list, "Baguette").ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ImportFromPlan(ctx, "2026-10-01", "2026-10-07"); err != nil {
		t.Fatal(err)
	}
	for _, item := range shoppingList(t, db).Items {
		if item.Name == "Baguette" {
			t.Error("Baguette erneut übernommen")
		}
	}
}

func TestImportWithoutServingsUsesFactorOne(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	if _, err := db.CreateEntry(ctx, EntryInput{Date: "2026-10-02", Meal: "dinner", Kind: KindRecipe, RecipeID: "linsensuppe"}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.sql.ExecContext(ctx, "UPDATE plan_entries SET servings = NULL"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ImportFromPlan(ctx, "2026-10-02", "2026-10-02"); err != nil {
		t.Fatal(err)
	}
	if got := itemNamed(t, shoppingList(t, db), "Linsen").Display; got != "250 g" {
		t.Errorf("Linsen = %q", got)
	}
}

func TestMergeRemembersAlias(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()
	mustAdd(t, db, "1 Zwiebel", "3 Zwiebeln", "1 Gemüsezwiebel")
	list := shoppingList(t, db)
	onion, onions := itemNamed(t, list, "Zwiebel"), itemNamed(t, list, "Zwiebeln")

	if err := db.MergeShoppingItem(ctx, onion.ID, onions.ID); err != nil {
		t.Fatal(err)
	}
	list = shoppingList(t, db)
	if got := itemNamed(t, list, "Zwiebeln").Display; got != "4" || len(list.Items) != 2 {
		t.Errorf("Zwiebeln = %q, artikel %v", got, names(list))
	}
	mustAdd(t, db, "2 zwiebel")
	if got := itemNamed(t, shoppingList(t, db), "Zwiebeln").Display; got != "6" {
		t.Errorf("künftige Zwiebel landet nicht bei Zwiebeln: %q", got)
	}

	// Kette: Zwiebeln → Gemüsezwiebel; danach zeigt auch „Zwiebel“ direkt auf Gemüsezwiebel.
	list = shoppingList(t, db)
	if err := db.MergeShoppingItem(ctx, itemNamed(t, list, "Zwiebeln").ID, itemNamed(t, list, "Gemüsezwiebel").ID); err != nil {
		t.Fatal(err)
	}
	aliases, err := db.ShoppingAliases(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(aliases) != 2 || aliases[0].ToName != "Gemüsezwiebel" || aliases[1].ToName != "Gemüsezwiebel" {
		t.Errorf("aliasse = %+v", aliases)
	}
	if err := db.DeleteShoppingAlias(ctx, "zwiebel"); err != nil {
		t.Fatal(err)
	}
	mustAdd(t, db, "1 Zwiebel")
	itemNamed(t, shoppingList(t, db), "Zwiebel")
	if err := db.MergeShoppingItem(ctx, onions.ID, onions.ID); !isInvalidShopping(err) {
		t.Errorf("mit sich selbst: %v", err)
	}
}

func TestUpdateShoppingItemRemembersChoices(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()
	mustAdd(t, db, "200 g Feta", "Äpfel")
	list := shoppingList(t, db)
	feta := itemNamed(t, list, "Feta")
	if categoryName(list, feta.CategoryID) != "Käse" {
		t.Fatalf("Feta unter %q", categoryName(list, feta.CategoryID))
	}

	if err := db.CreateShoppingCategory(ctx, "Käsetheke"); err != nil {
		t.Fatal(err)
	}
	if err := db.CreateShop(ctx, "Wochenmarkt"); err != nil {
		t.Fatal(err)
	}
	list = shoppingList(t, db)
	counter := categoryID(t, list, "Käsetheke")
	market := list.Stores[0].ID
	if err := db.UpdateShoppingItem(ctx, feta.ID, ShoppingItemPatch{CategoryID: &counter, SetStore: true, StoreID: &market}); err != nil {
		t.Fatal(err)
	}
	if err := db.DeleteShoppingItem(ctx, feta.ID); err != nil {
		t.Fatal(err)
	}
	mustAdd(t, db, "Feta")
	feta = itemNamed(t, shoppingList(t, db), "Feta")
	if feta.CategoryID != counter || feta.StoreID != market {
		t.Errorf("gemerkte wahl nicht übernommen: %+v", feta)
	}

	// Menge von Hand ersetzt die Anteile.
	amount := "500 g"
	if err := db.UpdateShoppingItem(ctx, feta.ID, ShoppingItemPatch{Quantity: &amount}); err != nil {
		t.Fatal(err)
	}
	feta = itemNamed(t, shoppingList(t, db), "Feta")
	if feta.Display != "500 g" || len(feta.Sources) != 1 || feta.Sources[0].Kind != PartManual {
		t.Errorf("menge = %+v", feta)
	}
	bad := "etwas"
	if err := db.UpdateShoppingItem(ctx, feta.ID, ShoppingItemPatch{Quantity: &bad}); !isInvalidShopping(err) {
		t.Errorf("unlesbare menge: %v", err)
	}
	unknown := "cat-fehlt"
	if err := db.UpdateShoppingItem(ctx, feta.ID, ShoppingItemPatch{CategoryID: &unknown}); !isInvalidShopping(err) {
		t.Errorf("unbekannte kategorie: %v", err)
	}

	// Umbenennen auf einen vorhandenen Namen fasst zusammen.
	apples := itemNamed(t, shoppingList(t, db), "Äpfel")
	name := "feta"
	if err := db.UpdateShoppingItem(ctx, apples.ID, ShoppingItemPatch{Name: &name}); err != nil {
		t.Fatal(err)
	}
	if list := shoppingList(t, db); len(list.Items) != 1 {
		t.Errorf("nach dem Umbenennen: %v", names(list))
	}

	// Geschäft entfernen.
	if err := db.UpdateShoppingItem(ctx, feta.ID, ShoppingItemPatch{SetStore: true}); err != nil {
		t.Fatal(err)
	}
	if got := itemNamed(t, shoppingList(t, db), "Feta").StoreID; got != "" {
		t.Errorf("geschäft = %q", got)
	}
}

func TestCategoriesAndShops(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()
	mustAdd(t, db, "Zucchini", "Cola")
	list := shoppingList(t, db)
	vegetables := categoryID(t, list, "Obst & Gemüse")
	drinks := categoryID(t, list, "Getränke")

	// Getränke nach oben.
	ids := []string{drinks}
	for _, c := range list.Categories {
		if c.ID != drinks {
			ids = append(ids, c.ID)
		}
	}
	if err := db.ReorderShoppingCategories(ctx, ids); err != nil {
		t.Fatal(err)
	}
	list = shoppingList(t, db)
	if list.Categories[0].Name != "Getränke" || list.Items[0].Name != "Cola" {
		t.Errorf("reihenfolge: %v / %v", list.Categories[0], names(list))
	}
	if err := db.ReorderShoppingCategories(ctx, ids[1:]); !isInvalidShopping(err) {
		t.Errorf("unvollständige reihenfolge: %v", err)
	}

	// Löschen verschiebt nach Sonstiges, auch für künftige Vorschläge.
	if err := db.DeleteShoppingCategory(ctx, vegetables); err != nil {
		t.Fatal(err)
	}
	mustAdd(t, db, "Gurke")
	list = shoppingList(t, db)
	for _, name := range []string{"Zucchini", "Gurke"} {
		if got := categoryName(list, itemNamed(t, list, name).CategoryID); got != "Sonstiges" {
			t.Errorf("%s unter %q", name, got)
		}
	}
	other := categoryID(t, list, "Sonstiges")
	if err := db.DeleteShoppingCategory(ctx, other); !isInvalidShopping(err) {
		t.Errorf("Sonstiges löschen: %v", err)
	}
	if err := db.RenameShoppingCategory(ctx, drinks, "Trinken"); err != nil {
		t.Fatal(err)
	}
	if err := db.RenameShoppingCategory(ctx, drinks, " "); !isInvalidShopping(err) {
		t.Errorf("leerer name: %v", err)
	}

	if err := db.CreateShop(ctx, "Supermarkt"); err != nil {
		t.Fatal(err)
	}
	shop := shoppingList(t, db).Stores[0]
	if err := db.RenameShop(ctx, shop.ID, "Discounter"); err != nil {
		t.Fatal(err)
	}
	cola := itemNamed(t, shoppingList(t, db), "Cola")
	if err := db.UpdateShoppingItem(ctx, cola.ID, ShoppingItemPatch{SetStore: true, StoreID: &shop.ID}); err != nil {
		t.Fatal(err)
	}
	if err := db.DeleteShop(ctx, shop.ID); err != nil {
		t.Fatal(err)
	}
	list = shoppingList(t, db)
	if len(list.Stores) != 0 || itemNamed(t, list, "Cola").StoreID != "" {
		t.Errorf("nach dem Löschen des Geschäfts: %+v", list)
	}
}

func TestStaples(t *testing.T) {
	db := openTestDB(t, tempPath(t))
	ctx := context.Background()
	for _, text := range []string{"Kaffee", "Spülmittel", "1 kg Reis", "kaffee"} {
		if err := db.CreateStaple(ctx, text); err != nil {
			t.Fatal(err)
		}
	}
	staples, err := db.Staples(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(staples) != 3 || staples[2].Text != "1 kg Reis" {
		t.Fatalf("vorrat = %+v", staples)
	}
	if err := db.AddStaplesToList(ctx, []string{staples[0].ID, staples[2].ID}); err != nil {
		t.Fatal(err)
	}
	list := shoppingList(t, db)
	if len(list.Items) != 2 || itemNamed(t, list, "Reis").Display != "1 kg" || itemNamed(t, list, "Kaffee").Sources[0].Kind != PartStaple {
		t.Errorf("liste = %+v", list.Items)
	}
	if err := db.AddStaplesToList(ctx, []string{"st-fehlt"}); !errors.Is(err, ErrNotFound) {
		t.Errorf("unbekannter vorrat: %v", err)
	}
	if err := db.DeleteStaple(ctx, staples[1].ID); err != nil {
		t.Fatal(err)
	}
	if staples, _ := db.Staples(ctx); len(staples) != 2 {
		t.Errorf("nach dem Löschen: %+v", staples)
	}
}

func TestShoppingMigrationOnExistingData(t *testing.T) {
	// Eine Datenbank mit Plan bekommt die Einkaufstabellen, ohne dass sich der Plan ändert.
	db := seededDB(t)
	entry := planRecipe(t, db, "2026-10-02", "linsensuppe")
	if _, err := db.sql.Exec("PRAGMA foreign_key_check"); err != nil {
		t.Fatal(err)
	}
	if got, err := db.GetEntry(context.Background(), entry.ID); err != nil || got.RecipeID != "linsensuppe" {
		t.Errorf("eintrag = %+v, %v", got, err)
	}
	// Gelöschte Einträge verschwinden aus den übernommenen.
	if _, err := db.ImportFromPlan(context.Background(), "2026-10-02", "2026-10-02"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.DeleteEntry(context.Background(), entry.ID); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.sql.QueryRow("SELECT COUNT(*) FROM shopping_imported_entries").Scan(&count); err != nil || count != 0 {
		t.Errorf("übernommene einträge = %d, %v", count, err)
	}
}
