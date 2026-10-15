package store

import (
	"context"
	"slices"
	"testing"
)

func TestMenuEntriesSpiegelnPlanEntrySpalten(t *testing.T) {
	db := seededDB(t)
	plan := tableColumns(t, db, "plan_entries")
	menu := tableColumns(t, db, "menu_entries")
	for _, column := range []string{"id", "meal", "position", "kind", "recipe_id", "servings", "text", "leftover_of"} {
		if !slices.Contains(plan, column) || !slices.Contains(menu, column) {
			t.Errorf("fachliche Spalte %q fehlt: plan=%v menu=%v", column, plan, menu)
		}
	}
	if !slices.Contains(plan, "date") || !slices.Contains(menu, "menu_id") || !slices.Contains(menu, "day") {
		t.Errorf("Zielspalten fehlen: plan=%v menu=%v", plan, menu)
	}
}

func TestPlanAlsMenuSpeichernWandeltExterneResteInNotiz(t *testing.T) {
	db := seededDB(t)
	ctx := context.Background()
	original := planRecipe(t, db, "2026-09-27", "haehnchen-curry")
	if _, err := db.CreateEntry(ctx, EntryInput{Date: "2026-09-28", Meal: "lunch", Kind: KindLeftover, LeftoverOf: original.ID}); err != nil {
		t.Fatal(err)
	}
	menu, err := db.CreateMenu(ctx, MenuInput{Name: "Reste-Woche"}, week40)
	if err != nil {
		t.Fatal(err)
	}
	entry := menu.Entries[1][0]
	if entry.Kind != KindNote || entry.Text != "Reste: Hähnchen-Curry" {
		t.Errorf("externe Reste = %+v", entry)
	}
}

func tableColumns(t *testing.T, db *DB, table string) []string {
	t.Helper()
	rows, err := db.sql.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var columns []string
	for rows.Next() {
		var cid, notNull, pk int
		var name, typ string
		var defaultValue any
		if err := rows.Scan(&cid, &name, &typ, &notNull, &defaultValue, &pk); err != nil {
			t.Fatal(err)
		}
		columns = append(columns, name)
	}
	return columns
}
