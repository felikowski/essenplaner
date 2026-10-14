package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

// Grenzen für von Hand eingegebene Rezepte.
const (
	maxTitleLength       = 200
	maxIngredients       = 100
	maxIngredientLength  = 200
	maxInstructions      = 50
	maxInstructionLength = 2000
)

// fieldError ist ein Validierungsfehler mit dem betroffenen Feld, damit das Formular ihn dort anzeigen kann.
type fieldError struct {
	Field   string
	Message string
}

func (e fieldError) Error() string { return e.Message }

type validationBody struct {
	Error string `json:"error"`
	Field string `json:"field"`
}

func writeFieldError(w http.ResponseWriter, err fieldError) {
	writeJSON(w, http.StatusUnprocessableEntity, validationBody{Error: err.Message, Field: err.Field})
}

// recipeBody ist der Body von POST /api/recipes und PUT /api/recipes/{id}.
type recipeBody struct {
	Title        *string         `json:"title"`
	Servings     json.RawMessage `json:"servings"`
	Ingredients  []string        `json:"ingredients"`
	Instructions []string        `json:"instructions"`
}

// decodeRecipeInput liest und prüft den Body. Fehler sind entweder ein fieldError (422) oder ein Formatfehler (400).
func decodeRecipeInput(r *http.Request, w http.ResponseWriter) (store.RecipeInput, error) {
	var body recipeBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		return store.RecipeInput{}, errors.New("invalid JSON body")
	}

	input := store.RecipeInput{}
	if body.Title != nil {
		input.Title = strings.TrimSpace(*body.Title)
	}
	if input.Title == "" {
		return input, fieldError{"title", "Bitte einen Titel eingeben."}
	}
	if utf8.RuneCountInString(input.Title) > maxTitleLength {
		return input, fieldError{"title", fmt.Sprintf("Der Titel darf höchstens %d Zeichen lang sein.", maxTitleLength)}
	}

	if raw := strings.TrimSpace(string(body.Servings)); raw != "" && raw != "null" {
		var servings int
		if err := json.Unmarshal(body.Servings, &servings); err != nil || servings < 1 || servings > 99 {
			return input, fieldError{"servings", "Portionen müssen eine ganze Zahl von 1 bis 99 sein."}
		}
		input.Servings = &servings
	}

	var err error
	if input.Ingredients, err = cleanLines(body.Ingredients, maxIngredients, maxIngredientLength, "ingredients", "Zutaten", "Eine Zutat"); err != nil {
		return input, err
	}
	if input.Instructions, err = cleanLines(body.Instructions, maxInstructions, maxInstructionLength, "instructions", "Schritte", "Ein Schritt"); err != nil {
		return input, err
	}
	return input, nil
}

// cleanLines verwirft leere Zeilen und prüft Anzahl und Länge. one ist der Satzanfang für eine Zeile („Eine Zutat“).
func cleanLines(lines []string, maxCount, maxLength int, field, plural, one string) ([]string, error) {
	var result []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if utf8.RuneCountInString(line) > maxLength {
			return nil, fieldError{field, fmt.Sprintf("%s darf höchstens %d Zeichen lang sein.", one, maxLength)}
		}
		result = append(result, line)
	}
	if len(result) > maxCount {
		return nil, fieldError{field, fmt.Sprintf("Höchstens %d %s sind möglich.", maxCount, plural)}
	}
	return result, nil
}

func (s *Server) handleCreateRecipe(w http.ResponseWriter, r *http.Request) {
	input, err := decodeRecipeInput(r, w)
	if s.writeInputError(w, err) {
		return
	}
	recipe, err := s.recipes.CreateRecipe(r.Context(), input)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, recipe)
}

func (s *Server) handleUpdateRecipe(w http.ResponseWriter, r *http.Request) {
	input, err := decodeRecipeInput(r, w)
	if s.writeInputError(w, err) {
		return
	}
	recipe, err := s.recipes.UpdateRecipe(r.Context(), r.PathValue("id"), input)
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "recipe not found")
	case errors.Is(err, store.ErrTitleNotEditable):
		writeFieldError(w, fieldError{"title", "Der Titel lässt sich nur bei eigenen Rezepten ändern."})
	case err != nil:
		s.internalError(w, r, err)
	default:
		writeJSON(w, http.StatusOK, recipe)
	}
}

// writeInputError beantwortet Eingabefehler und meldet, ob es einen gab.
func (s *Server) writeInputError(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	var fe fieldError
	if errors.As(err, &fe) {
		writeFieldError(w, fe)
	} else {
		writeError(w, http.StatusBadRequest, err.Error())
	}
	return true
}
