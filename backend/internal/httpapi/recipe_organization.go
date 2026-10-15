package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

func (s *Server) handleUpdateRecipeOrganization(w http.ResponseWriter, r *http.Request) {
	patch, err := decodeOrganizationPatch(r, w)
	if s.writeInputError(w, err) {
		return
	}
	recipe, err := s.recipes.UpdateRecipeOrganization(r.Context(), r.PathValue("id"), patch)
	var invalid store.ErrInvalidOrganization
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "recipe not found")
	case errors.As(err, &invalid):
		writeFieldError(w, organizationFieldError(invalid.Field))
	case err != nil:
		s.internalError(w, r, err)
	default:
		writeJSON(w, http.StatusOK, recipe)
	}
}

func decodeOrganizationPatch(r *http.Request, w http.ResponseWriter) (store.RecipeOrganizationPatch, error) {
	var body map[string]json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		return store.RecipeOrganizationPatch{}, errors.New("invalid JSON body")
	}
	var patch store.RecipeOrganizationPatch
	for field, raw := range body {
		switch field {
		case "course":
			value, err := nullableString(raw)
			if err != nil {
				return patch, fieldError{"course", "Bitte einen gültigen Gang auswählen."}
			}
			patch.Course = store.Optional[string]{Set: true, Value: value}
		case "cuisine":
			value, err := nullableString(raw)
			if err != nil {
				return patch, fieldError{"cuisine", "Die Küche muss Text sein."}
			}
			patch.Cuisine = store.Optional[string]{Set: true, Value: value}
		case "tags":
			var value []string
			if string(raw) != "null" && json.Unmarshal(raw, &value) != nil {
				return patch, fieldError{"tags", "Tags müssen als Liste angegeben werden."}
			}
			patch.Tags = store.Optional[[]string]{Set: true, Value: value}
		case "rating":
			value, err := nullableInt(raw)
			if err != nil {
				return patch, fieldError{"rating", "Die Bewertung muss zwischen 1 und 5 liegen."}
			}
			patch.Rating = store.Optional[*int]{Set: true, Value: value}
		case "toTry":
			var value bool
			if err := json.Unmarshal(raw, &value); err != nil {
				return patch, fieldError{"toTry", "Ausprobieren muss wahr oder falsch sein."}
			}
			patch.ToTry = store.Optional[bool]{Set: true, Value: value}
		case "notes":
			value, err := nullableString(raw)
			if err != nil {
				return patch, fieldError{"notes", "Notizen müssen Text sein."}
			}
			patch.Notes = store.Optional[string]{Set: true, Value: value}
		case "totalMinutes":
			value, err := nullableInt(raw)
			if err != nil {
				return patch, fieldError{"totalMinutes", "Die Zeit muss eine ganze Zahl sein."}
			}
			patch.TotalMinutes = store.Optional[*int]{Set: true, Value: value}
		default:
			return patch, fieldError{field, fmt.Sprintf("Das Feld %q ist unbekannt.", field)}
		}
	}
	return patch, nil
}

func nullableString(raw json.RawMessage) (string, error) {
	if string(raw) == "null" {
		return "", nil
	}
	var value string
	err := json.Unmarshal(raw, &value)
	return value, err
}

func nullableInt(raw json.RawMessage) (*int, error) {
	if string(raw) == "null" {
		return nil, nil
	}
	var value int
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

func organizationFieldError(field string) fieldError {
	messages := map[string]string{
		"course":       "Bitte einen gültigen Gang auswählen.",
		"cuisine":      "Die Küche darf höchstens 50 Zeichen lang sein.",
		"tags":         "Es sind höchstens 20 Tags mit je 30 Zeichen möglich.",
		"rating":       "Die Bewertung muss zwischen 1 und 5 liegen.",
		"notes":        "Notizen dürfen höchstens 2000 Zeichen lang sein.",
		"totalMinutes": "Die Zeit muss zwischen 1 und 1440 Minuten liegen.",
		"name":         "Der Tag darf höchstens 30 Zeichen lang sein.",
	}
	return fieldError{field, messages[field]}
}

func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.recipes.ListTags(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

func (s *Server) handleRenameTag(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	name := strings.TrimSpace(body.Name)
	err := s.recipes.RenameTag(r.Context(), r.PathValue("key"), name)
	var invalid store.ErrInvalidOrganization
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "tag not found")
	case errors.As(err, &invalid):
		writeFieldError(w, organizationFieldError(invalid.Field))
	case err != nil:
		s.internalError(w, r, err)
	default:
		s.handleListTags(w, r)
	}
}

func (s *Server) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	err := s.recipes.DeleteTag(r.Context(), r.PathValue("key"))
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "tag not found")
	case err != nil:
		s.internalError(w, r, err)
	default:
		s.handleListTags(w, r)
	}
}
