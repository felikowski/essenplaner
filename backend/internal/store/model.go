package store

import (
	"context"
	"errors"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrUnknownRecipe = errors.New("unknown recipe")
	// ErrNotRemovable: Rezepte dieser Herkunft lassen sich nicht entfernen.
	ErrNotRemovable = errors.New("recipe cannot be removed")
)

// Herkunft eines Rezepts (Spalte origin).
const (
	OriginSeed      = "seed"
	OriginWebImport = "web-import"
)

const (
	SourcePDF = "pdf"
	SourceWeb = "web"
)

// Source ist die Herkunft eines Rezepts: eine PDF oder eine Webseite.
type Source struct {
	Kind   string `json:"kind"`
	PDFURL string `json:"pdfUrl,omitempty"`
	URL    string `json:"url,omitempty"`
}

// Ref liefert die Adresse der Quelle, unabhängig von der Art.
func (s Source) Ref() string {
	if s.Kind == SourcePDF {
		return s.PDFURL
	}
	return s.URL
}

func sourceFrom(kind, ref string) Source {
	if kind == SourcePDF {
		return Source{Kind: kind, PDFURL: ref}
	}
	return Source{Kind: kind, URL: ref}
}

// Recipe entspricht dem Typ Recipe im Frontend (src/types.ts).
// Fehlende Angaben werden im JSON weggelassen.
type Recipe struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Source       Source   `json:"source"`
	ImageURL     string   `json:"imageUrl,omitempty"`
	Servings     string   `json:"servings,omitempty"`
	Ingredients  []string `json:"ingredients,omitempty"`
	Instructions []string `json:"instructions,omitempty"`
	// Available ist false, wenn das Rezept entfernt wurde; es bleibt dann nur in bestehenden Plänen sichtbar.
	Available bool `json:"available"`
	// Removable zeigt an, ob sich das Rezept über die API entfernen lässt.
	Removable bool `json:"removable,omitempty"`
}

type RecipeStore interface {
	// ListRecipes liefert alle verfügbaren Rezepte, nach Titel sortiert.
	ListRecipes(ctx context.Context) ([]Recipe, error)
	// GetRecipe liefert auch nicht mehr verfügbare Rezepte, und ErrNotFound, wenn es die ID nicht gibt.
	GetRecipe(ctx context.Context, id string) (Recipe, error)
	// FindImported sucht ein importiertes Rezept über seine kanonische Adresse (ErrNotFound, wenn keins existiert).
	FindImported(ctx context.Context, canonicalURL string) (Recipe, error)
	// SaveImported legt ein importiertes Rezept an oder macht ein entferntes mit derselben Adresse wieder verfügbar.
	// created meldet, ob ein neues Rezept entstanden ist.
	SaveImported(ctx context.Context, canonicalURL string, recipe Recipe) (saved Recipe, created bool, err error)
	// RemoveRecipe markiert ein Rezept als nicht mehr verfügbar (ErrNotFound, ErrNotRemovable).
	RemoveRecipe(ctx context.Context, id string) error
}

type PlanStore interface {
	// PlannedDays liefert die belegten Tage (Datum → Rezept-ID) zwischen from und to einschließlich.
	PlannedDays(ctx context.Context, from, to string) (map[string]string, error)
	// SetDay ordnet einem Datum ein Rezept zu; nil entfernt die Zuordnung.
	// Liefert ErrUnknownRecipe, wenn es das Rezept nicht gibt.
	SetDay(ctx context.Context, date string, recipeID *string) error
}
