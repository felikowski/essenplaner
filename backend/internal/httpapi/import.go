package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"

	"github.com/felikowski/essenplaner/backend/internal/ingredient"
	"github.com/felikowski/essenplaner/backend/internal/safefetch"
	"github.com/felikowski/essenplaner/backend/internal/store"
	"github.com/felikowski/essenplaner/backend/internal/webimport"
)

// RecipeImporter liest ein Rezept von einer Webseite (in Tests ein Fake ohne Netzwerk).
type RecipeImporter interface {
	Import(ctx context.Context, u *url.URL) (*webimport.Result, error)
}

// WithImporter aktiviert POST /api/recipes/import.
func (s *Server) WithImporter(importer RecipeImporter) *Server {
	s.importer = importer
	return s
}

func (s *Server) handleImportRecipe(w http.ResponseWriter, r *http.Request) {
	if s.importer == nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	var body struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	target, err := safefetch.ParseURL(body.URL)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Bitte eine gültige Adresse einer öffentlichen Webseite angeben.")
		return
	}

	// Schon importiert? Dann wird die Seite trotzdem neu gelesen, damit nicht bearbeitete Angaben aktuell
	// bleiben. Ist sie nicht mehr erreichbar, wird das vorhandene Rezept geliefert.
	existing, err := s.recipes.FindImported(r.Context(), webimport.Normalize(target))
	found := err == nil
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		s.internalError(w, r, err)
		return
	}

	result, err := s.importer.Import(r.Context(), target)
	if err != nil && found {
		s.logger.Info("rezeptseite erneut nicht lesbar, liefere vorhandenes rezept", "url", target.String(), "err", err)
		s.respondImported(w, r, existing)
		return
	}
	switch {
	case err == nil:
	case errors.Is(err, safefetch.ErrInvalidURL), errors.Is(err, safefetch.ErrBlocked):
		writeError(w, http.StatusBadRequest, "Diese Adresse kann nicht abgerufen werden.")
		return
	case errors.Is(err, webimport.ErrNoRecipe):
		writeError(w, http.StatusUnprocessableEntity, "Auf dieser Seite wurden keine Rezeptdaten gefunden.")
		return
	case errors.Is(err, safefetch.ErrTooLarge):
		writeError(w, http.StatusBadGateway, "Die Seite ist zu groß.")
		return
	case errors.Is(err, safefetch.ErrFetch):
		s.logger.Info("rezeptseite nicht abrufbar", "url", target.String(), "err", err)
		writeError(w, http.StatusBadGateway, "Die Seite konnte nicht abgerufen werden.")
		return
	default:
		s.internalError(w, r, err)
		return
	}

	saved, created, err := s.recipes.SaveImported(r.Context(), result.CanonicalURL, store.Recipe{
		Title:        result.Recipe.Title,
		ImageURL:     result.Recipe.ImageURL,
		Servings:     store.ParseServings(result.Recipe.Yield),
		Ingredients:  ingredient.ParseAll(result.Recipe.Ingredients),
		Instructions: result.Recipe.Instructions,
		Course:       result.Recipe.Course,
		Cuisine:      result.Recipe.Cuisine,
		Tags:         result.Recipe.Tags,
		TotalMinutes: result.Recipe.TotalMinutes,
	})
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if created {
		writeJSON(w, http.StatusCreated, saved)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

// respondImported liefert ein vorhandenes Rezept und macht es wieder verfügbar, falls es entfernt war.
func (s *Server) respondImported(w http.ResponseWriter, r *http.Request, existing store.Recipe) {
	if !existing.Available {
		reactivated, _, err := s.recipes.SaveImported(r.Context(), existing.Source.URL, existing)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		existing = reactivated
	}
	writeJSON(w, http.StatusOK, existing)
}

func (s *Server) handleRemoveRecipe(w http.ResponseWriter, r *http.Request) {
	err := s.recipes.RemoveRecipe(r.Context(), r.PathValue("id"))
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "recipe not found")
	case errors.Is(err, store.ErrNotRemovable):
		writeError(w, http.StatusConflict, "Dieses Rezept lässt sich nicht entfernen.")
	case err != nil:
		s.internalError(w, r, err)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}
