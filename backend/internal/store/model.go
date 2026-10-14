package store

import (
	"context"
	"errors"
	"regexp"
	"strconv"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrUnknownRecipe = errors.New("unknown recipe")
	// ErrNotRemovable: Rezepte dieser Herkunft lassen sich nicht entfernen.
	ErrNotRemovable = errors.New("recipe cannot be removed")
	// ErrTitleNotEditable: der Titel kommt aus der Quelle und lässt sich nur bei eigenen Rezepten ändern.
	ErrTitleNotEditable = errors.New("title cannot be changed")
)

// Herkunft eines Rezepts (Spalte origin).
const (
	OriginSeed      = "seed"
	OriginWebImport = "web-import"
	OriginManual    = "manual"
)

const (
	SourcePDF    = "pdf"
	SourceWeb    = "web"
	SourceManual = "manual"
)

// Felder, die sich von Hand bearbeiten lassen (Spalte edited_fields).
const (
	FieldServings     = "servings"
	FieldIngredients  = "ingredients"
	FieldInstructions = "instructions"
)

// Source ist die Herkunft eines Rezepts: eine PDF, eine Webseite oder ein eigenes Rezept ohne Quelle.
type Source struct {
	Kind   string `json:"kind"`
	PDFURL string `json:"pdfUrl,omitempty"`
	URL    string `json:"url,omitempty"`
}

// Ref liefert die Adresse der Quelle, unabhängig von der Art.
func (s Source) Ref() string {
	switch s.Kind {
	case SourcePDF:
		return s.PDFURL
	case SourceWeb:
		return s.URL
	}
	return ""
}

func sourceFrom(kind, ref string) Source {
	switch kind {
	case SourcePDF:
		return Source{Kind: kind, PDFURL: ref}
	case SourceWeb:
		return Source{Kind: kind, URL: ref}
	}
	return Source{Kind: kind}
}

// Recipe entspricht dem Typ Recipe im Frontend (src/types.ts).
// Fehlende Angaben werden im JSON weggelassen.
type Recipe struct {
	ID           string                  `json:"id"`
	Title        string                  `json:"title"`
	Source       Source                  `json:"source"`
	ImageURL     string                  `json:"imageUrl,omitempty"`
	Servings     *int                    `json:"servings,omitempty"`
	Ingredients  []ingredient.Ingredient `json:"ingredients,omitempty"`
	Instructions []string                `json:"instructions,omitempty"`
	// Available ist false, wenn das Rezept entfernt wurde; es bleibt dann nur in bestehenden Plänen sichtbar.
	Available bool `json:"available"`
	// Removable zeigt an, ob sich das Rezept über die API entfernen lässt.
	Removable bool `json:"removable,omitempty"`
	// TitleEditable zeigt an, ob sich der Titel ändern lässt (nur bei eigenen Rezepten).
	TitleEditable bool `json:"titleEditable,omitempty"`
}

// RecipeInput sind die von Hand bearbeitbaren Angaben eines Rezepts. Zutaten sind Zeilen als Text;
// zerlegt werden sie beim Speichern.
type RecipeInput struct {
	Title        string
	Servings     *int
	Ingredients  []string
	Instructions []string
}

var leadingNumber = regexp.MustCompile(`\d+`)

// ParseServings liest die erste Zahl aus einer Portionsangabe wie „4 Portionen“ oder „Makes 12“.
// Liefert nil, wenn es keine Zahl zwischen 1 und 99 gibt.
func ParseServings(text string) *int {
	match := leadingNumber.FindString(text)
	if match == "" {
		return nil
	}
	n, err := strconv.Atoi(match)
	if err != nil || n < 1 || n > 99 {
		return nil
	}
	return &n
}

type RecipeStore interface {
	// ListRecipes liefert alle verfügbaren Rezepte, nach Titel sortiert.
	ListRecipes(ctx context.Context) ([]Recipe, error)
	// GetRecipe liefert auch nicht mehr verfügbare Rezepte, und ErrNotFound, wenn es die ID nicht gibt.
	GetRecipe(ctx context.Context, id string) (Recipe, error)
	// CreateRecipe legt ein eigenes Rezept an.
	CreateRecipe(ctx context.Context, input RecipeInput) (Recipe, error)
	// UpdateRecipe ersetzt Portionen, Zutaten und Zubereitung und bei eigenen Rezepten den Titel
	// (ErrNotFound, ErrTitleNotEditable).
	UpdateRecipe(ctx context.Context, id string, input RecipeInput) (Recipe, error)
	// FindImported sucht ein importiertes Rezept über seine kanonische Adresse (ErrNotFound, wenn keins existiert).
	FindImported(ctx context.Context, canonicalURL string) (Recipe, error)
	// SaveImported legt ein importiertes Rezept an oder aktualisiert ein vorhandenes mit derselben Adresse,
	// ohne von Hand bearbeitete Felder zu überschreiben, und macht es wieder verfügbar.
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
