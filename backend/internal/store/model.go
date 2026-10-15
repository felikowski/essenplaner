package store

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strconv"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
)

var (
	ErrNotFound = errors.New("not found")
	// ErrNotRemovable: Rezepte dieser Herkunft lassen sich nicht entfernen.
	ErrNotRemovable = errors.New("recipe cannot be removed")
	// ErrTitleNotEditable: der Titel kommt aus der Quelle und lässt sich nur bei eigenen Rezepten ändern.
	ErrTitleNotEditable = errors.New("title cannot be changed")
)

// ErrInvalidOrganization bezeichnet eine ungültige Angabe zur Einordnung eines Rezepts.
type ErrInvalidOrganization struct {
	Field string
}

func (e ErrInvalidOrganization) Error() string { return "invalid recipe organization: " + e.Field }

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
	TitleEditable bool     `json:"titleEditable,omitempty"`
	Course        string   `json:"course,omitempty"`
	Cuisine       string   `json:"cuisine,omitempty"`
	Tags          []string `json:"tags,omitempty"`
	Rating        *int     `json:"rating,omitempty"`
	ToTry         bool     `json:"toTry,omitempty"`
	Notes         string   `json:"notes,omitempty"`
	TotalMinutes  *int     `json:"totalMinutes,omitempty"`
	CreatedAt     string   `json:"createdAt"`
	LastPlannedOn string   `json:"lastPlannedOn,omitempty"`
}

// Optional unterscheidet bei Teiländerungen zwischen „nicht übergeben“ und einem leeren Wert.
type Optional[T any] struct {
	Set   bool
	Value T
}

// RecipeOrganizationPatch enthält die optionalen Felder der Einordnung.
type RecipeOrganizationPatch struct {
	Course       Optional[string]
	Cuisine      Optional[string]
	Tags         Optional[[]string]
	Rating       Optional[*int]
	ToTry        Optional[bool]
	Notes        Optional[string]
	TotalMinutes Optional[*int]
}

// TagSummary ist ein vorhandener Tag mit der Zahl seiner Rezepte.
type TagSummary struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
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
	// UpdateRecipeOrganization ändert nur übergebene Einordnungsfelder.
	UpdateRecipeOrganization(ctx context.Context, id string, patch RecipeOrganizationPatch) (Recipe, error)
	// ListTags liefert alle Tags alphabetisch mit ihrer Verwendung.
	ListTags(ctx context.Context) ([]TagSummary, error)
	// RenameTag benennt einen Tag um und führt ihn bei Bedarf mit einem vorhandenen zusammen.
	RenameTag(ctx context.Context, key, name string) error
	// DeleteTag entfernt einen Tag aus allen Rezepten.
	DeleteTag(ctx context.Context, key string) error
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
	// Entries liefert die Einträge zwischen from und to einschließlich, je Datum sortiert.
	Entries(ctx context.Context, from, to string) (map[string][]Entry, error)
	// GetEntry liefert ErrNotFound, wenn es den Eintrag nicht gibt.
	GetEntry(ctx context.Context, id string) (Entry, error)
	// CreateEntry legt einen Eintrag an (ErrInvalidEntry bei unzulässigen Verweisen oder Texten).
	CreateEntry(ctx context.Context, input EntryInput) (Entry, error)
	// UpdateEntry ändert einen Eintrag und liefert ihn vor und nach der Änderung.
	UpdateEntry(ctx context.Context, id string, patch EntryPatch) (before, after Entry, err error)
	// DeleteEntry löscht einen Eintrag und liefert die Daten aller betroffenen Tage.
	DeleteEntry(ctx context.Context, id string) ([]string, error)
	// CopyWeek kopiert die Einträge der Tage from auf die Tage to und zählt übersprungene Einträge.
	CopyWeek(ctx context.Context, from, to []string, replace bool) (skipped int, err error)
	// RecipeHistory liefert die Daten, an denen ein Rezept geplant war, neueste zuerst.
	RecipeHistory(ctx context.Context, recipeID string) ([]string, error)
}

type SettingsStore interface {
	// Settings liefert alle Haushalts-Einstellungen mit Standardwerten für nicht gespeicherte.
	Settings(ctx context.Context) (map[string]any, error)
	// UpdateSettings speichert die Werte, wenn alle gültig sind (sonst ErrInvalidSetting).
	UpdateSettings(ctx context.Context, values map[string]json.RawMessage) (map[string]any, error)
}
