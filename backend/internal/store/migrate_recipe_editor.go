package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
)

// migrateRecipeEditor wandelt Portionen („4 Portionen“ → 4) und Zutaten (Text → zerlegte Objekte) aus der alten
// Tabelle um und ersetzt sie anschließend durch recipes_new (siehe 003_recipe_editor.sql).
func migrateRecipeEditor(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, "SELECT id, servings, ingredients_json FROM recipes")
	if err != nil {
		return err
	}
	type update struct {
		id          string
		servings    *int
		ingredients any
	}
	var updates []update
	for rows.Next() {
		var id string
		var servings, ingredientsJSON sql.NullString
		if err := rows.Scan(&id, &servings, &ingredientsJSON); err != nil {
			rows.Close()
			return err
		}
		u := update{id: id, servings: ParseServings(servings.String)}
		if ingredientsJSON.Valid {
			var lines []string
			if err := json.Unmarshal([]byte(ingredientsJSON.String), &lines); err != nil {
				rows.Close()
				return fmt.Errorf("zutaten von %s: %w", id, err)
			}
			if u.ingredients, err = jsonOrNull(ingredient.ParseAll(lines)); err != nil {
				rows.Close()
				return err
			}
		}
		updates = append(updates, u)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, u := range updates {
		if _, err := tx.ExecContext(ctx, "UPDATE recipes_new SET servings = ?, ingredients_json = ? WHERE id = ?",
			u.servings, u.ingredients, u.id); err != nil {
			return fmt.Errorf("rezept %s umwandeln: %w", u.id, err)
		}
	}

	_, err = tx.ExecContext(ctx, `
		DROP TABLE recipes;
		ALTER TABLE recipes_new RENAME TO recipes;
		CREATE UNIQUE INDEX recipes_canonical_url ON recipes (canonical_url) WHERE origin = 'web-import';
	`)
	return err
}
