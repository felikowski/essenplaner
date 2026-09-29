// Package seed legt beim ersten Start Beispielrezepte an, solange noch keine
// echten Rezeptquellen angebunden sind.
package seed

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

// Origin markiert die Beispielrezepte in der Datenbank, damit sie sich später gezielt entfernen lassen.
const Origin = "seed"

// recipes.json ist eine Kopie von frontend/public/mock/recipes.json (ein Test prüft, dass beide gleich sind).
//
//go:embed recipes.json
var recipesJSON []byte

type Target interface {
	CountRecipes(ctx context.Context) (int, error)
	InsertRecipes(ctx context.Context, origin string, recipes []store.Recipe) error
}

// Recipes liefert die eingebetteten Beispielrezepte.
func Recipes() ([]store.Recipe, error) {
	var recipes []store.Recipe
	if err := json.Unmarshal(recipesJSON, &recipes); err != nil {
		return nil, fmt.Errorf("beispielrezepte lesen: %w", err)
	}
	return recipes, nil
}

// Run legt die Beispielrezepte an, wenn die Rezepttabelle leer ist, und meldet, ob es etwas getan hat.
func Run(ctx context.Context, target Target) (bool, error) {
	count, err := target.CountRecipes(ctx)
	if err != nil {
		return false, err
	}
	if count > 0 {
		return false, nil
	}
	recipes, err := Recipes()
	if err != nil {
		return false, err
	}
	if err := target.InsertRecipes(ctx, Origin, recipes); err != nil {
		return false, fmt.Errorf("beispielrezepte anlegen: %w", err)
	}
	return true, nil
}
