// Package httpapi stellt die JSON-API unter /api/ und den Health-Check bereit.
package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

const maxBodyBytes = 1 << 20

type HealthChecker interface {
	Ping(ctx context.Context) error
}

type Server struct {
	recipes  store.RecipeStore
	plans    store.PlanStore
	settings store.SettingsStore
	shopping store.ShoppingStore
	health   HealthChecker
	importer RecipeImporter
	logger   *slog.Logger
}

// Stores bündelt die Datenzugriffe der API. In der Anwendung ist alles dieselbe Datenbank.
type Stores struct {
	Recipes  store.RecipeStore
	Plans    store.PlanStore
	Settings store.SettingsStore
	Shopping store.ShoppingStore
	Health   HealthChecker
}

func NewServer(stores Stores, logger *slog.Logger) *Server {
	return &Server{recipes: stores.Recipes, plans: stores.Plans, settings: stores.Settings, shopping: stores.Shopping, health: stores.Health, logger: logger}
}

// StoresFrom nutzt eine Datenbank für alle Zugriffe.
func StoresFrom(db interface {
	store.RecipeStore
	store.PlanStore
	store.SettingsStore
	store.ShoppingStore
	HealthChecker
}) Stores {
	return Stores{Recipes: db, Plans: db, Settings: db, Shopping: db, Health: db}
}

// Handler liefert den vollständigen Router. static beantwortet alle Pfade außerhalb
// von /api/ und /healthz (das eingebettete Frontend); nil bedeutet nur API.
func (s *Server) Handler(static http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/recipes", s.handleListRecipes)
	mux.HandleFunc("POST /api/recipes", s.handleCreateRecipe)
	mux.HandleFunc("GET /api/recipes/{id}", s.handleGetRecipe)
	mux.HandleFunc("PUT /api/recipes/{id}", s.handleUpdateRecipe)
	mux.HandleFunc("DELETE /api/recipes/{id}", s.handleRemoveRecipe)
	mux.HandleFunc("POST /api/recipes/import", s.handleImportRecipe)
	mux.HandleFunc("GET /api/recipes/{id}/history", s.handleRecipeHistory)
	mux.HandleFunc("GET /api/weeks/{week}", s.handleGetWeek)
	mux.HandleFunc("POST /api/weeks/{week}/copy", s.handleCopyWeek)
	mux.HandleFunc("POST /api/entries", s.handleCreateEntry)
	mux.HandleFunc("PATCH /api/entries/{id}", s.handleUpdateEntry)
	mux.HandleFunc("DELETE /api/entries/{id}", s.handleDeleteEntry)
	mux.HandleFunc("GET /api/settings", s.handleGetSettings)
	mux.HandleFunc("PATCH /api/settings", s.handleUpdateSettings)
	s.routeShopping(mux)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	mux.HandleFunc("GET /healthz", s.handleHealth)
	if static != nil {
		mux.Handle("/", static)
	}
	return Logging(s.logger, Recover(s.logger, mux))
}

// internalError protokolliert den Fehler und antwortet ohne technische Details.
func (s *Server) internalError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.Error("interner fehler", "method", r.Method, "path", r.URL.Path, "err", err)
	writeError(w, http.StatusInternalServerError, "internal error")
}

func (s *Server) handleListRecipes(w http.ResponseWriter, r *http.Request) {
	recipes, err := s.recipes.ListRecipes(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, recipes)
}

func (s *Server) handleGetRecipe(w http.ResponseWriter, r *http.Request) {
	recipe, err := s.recipes.GetRecipe(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "recipe not found")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, recipe)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.health.Ping(r.Context()); err != nil {
		s.logger.Error("health-check fehlgeschlagen", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
