// Package seed legt beim ersten Start Beispielrezepte an, solange noch keine
// echten Rezeptquellen angebunden sind.
package seed

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
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

// seedRecipe ist das Format von recipes.json: Zutaten als Zeilen, wie man sie eintippt.
type seedRecipe struct {
	ID           string       `json:"id"`
	Title        string       `json:"title"`
	Source       store.Source `json:"source"`
	ImageURL     string       `json:"imageUrl"`
	Servings     *int         `json:"servings"`
	Ingredients  []string     `json:"ingredients"`
	Instructions []string     `json:"instructions"`
	Course       string       `json:"course"`
	Cuisine      string       `json:"cuisine"`
	Tags         []string     `json:"tags"`
	Rating       *int         `json:"rating"`
	ToTry        bool         `json:"toTry"`
	Notes        string       `json:"notes"`
	TotalMinutes *int         `json:"totalMinutes"`
	CreatedAt    string       `json:"createdAt"`
}

// Recipes liefert die eingebetteten Beispielrezepte mit zerlegten Zutaten.
func Recipes() ([]store.Recipe, error) {
	var raw []seedRecipe
	if err := json.Unmarshal(recipesJSON, &raw); err != nil {
		return nil, fmt.Errorf("beispielrezepte lesen: %w", err)
	}
	recipes := make([]store.Recipe, len(raw))
	for i, r := range raw {
		recipes[i] = store.Recipe{
			ID: r.ID, Title: r.Title, Source: r.Source, ImageURL: r.ImageURL, Servings: r.Servings,
			Ingredients: ingredient.ParseAll(r.Ingredients), Instructions: r.Instructions,
			Course: r.Course, Cuisine: r.Cuisine, Tags: r.Tags, Rating: r.Rating, ToTry: r.ToTry,
			Notes: r.Notes, TotalMinutes: r.TotalMinutes, CreatedAt: r.CreatedAt,
		}
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
