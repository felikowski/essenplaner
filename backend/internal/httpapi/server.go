// Package httpapi stellt die JSON-API unter /api/ und den Health-Check bereit.
package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/felikowski/essenplaner/backend/internal/store"
	"github.com/felikowski/essenplaner/backend/internal/voice"
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
	menus    store.MenuStore
	health   HealthChecker
	importer RecipeImporter
	version  string
	auth     Authenticator
	hsts     bool
	logger   *slog.Logger

	voice        voice.Service
	voiceLimiter *rateLimiter
}

// Authenticator schützt die API (umgesetzt von auth.Service). Ohne ihn ist die API offen, das gibt es nur in Tests.
type Authenticator interface {
	// Register fügt Anmelde-Routen hinzu, etwa /api/auth/login und /api/me.
	Register(mux interface {
		HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
	})
	// Protect weist Anfragen an /api/ ohne gültige Sitzung und ändernde Anfragen fremder Origins ab.
	Protect(next http.Handler) http.Handler
}

// Stores bündelt die Datenzugriffe der API. In der Anwendung ist alles dieselbe Datenbank.
type Stores struct {
	Recipes  store.RecipeStore
	Plans    store.PlanStore
	Settings store.SettingsStore
	Shopping store.ShoppingStore
	Menus    store.MenuStore
	Health   HealthChecker
}

func NewServer(stores Stores, logger *slog.Logger) *Server {
	return &Server{recipes: stores.Recipes, plans: stores.Plans, settings: stores.Settings, shopping: stores.Shopping, menus: stores.Menus, health: stores.Health, version: "dev", logger: logger}
}

// WithAuth schützt die API mit einer Anmeldung. hsts schaltet Strict-Transport-Security ein (App läuft über https).
func (s *Server) WithAuth(a Authenticator, hsts bool) *Server {
	s.auth = a
	s.hsts = hsts
	return s
}

// WithVersion legt fest, welche Version /healthz meldet (beim Build eingebetteter Commit).
// Ein leerer Wert lässt den Standard "dev" stehen.
func (s *Server) WithVersion(version string) *Server {
	if version != "" {
		s.version = version
	}
	return s
}

// StoresFrom nutzt eine Datenbank für alle Zugriffe.
func StoresFrom(db interface {
	store.RecipeStore
	store.PlanStore
	store.SettingsStore
	store.ShoppingStore
	store.MenuStore
	HealthChecker
}) Stores {
	return Stores{Recipes: db, Plans: db, Settings: db, Shopping: db, Menus: db, Health: db}
}

// Handler liefert den vollständigen Router. static beantwortet alle Pfade außerhalb
// von /api/ und /healthz (das eingebettete Frontend); nil bedeutet nur API.
// Die API-Routen kommen aus routes, damit APIRoutes genau dieselbe Liste liefert.
func (s *Server) Handler(static http.Handler) http.Handler {
	mux := s.routes()
	if s.auth != nil {
		s.auth.Register(mux)
	}
	if static != nil {
		mux.Handle("/", static)
	}
	var h http.Handler = mux
	if s.auth != nil {
		h = s.auth.Protect(h)
	}
	return SecurityHeaders(s.hsts, Logging(s.logger, Recover(s.logger, h)))
}

// APIRoutes listet die Muster aller Routen der API (ohne Anmeldung und Frontend), etwa "GET /api/recipes".
func (s *Server) APIRoutes() []string {
	return s.routes().patterns
}

// routes zeichnet beim Registrieren die Muster auf, damit Tests alle Routen durchgehen können.
type routes struct {
	*http.ServeMux
	patterns []string
}

func (r *routes) HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request)) {
	r.patterns = append(r.patterns, pattern)
	r.ServeMux.HandleFunc(pattern, handler)
}

func (s *Server) routes() *routes {
	mux := &routes{ServeMux: http.NewServeMux()}
	mux.HandleFunc("GET /api/recipes", s.handleListRecipes)
	mux.HandleFunc("POST /api/recipes", s.handleCreateRecipe)
	mux.HandleFunc("GET /api/recipes/{id}", s.handleGetRecipe)
	mux.HandleFunc("PUT /api/recipes/{id}", s.handleUpdateRecipe)
	mux.HandleFunc("PATCH /api/recipes/{id}/organization", s.handleUpdateRecipeOrganization)
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
	mux.HandleFunc("GET /api/tags", s.handleListTags)
	mux.HandleFunc("PATCH /api/tags/{key}", s.handleRenameTag)
	mux.HandleFunc("DELETE /api/tags/{key}", s.handleDeleteTag)
	s.routeMenus(mux)
	s.routeShopping(mux)
	s.routeVoice(mux)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	mux.HandleFunc("GET /healthz", s.handleHealth)
	return mux
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
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": s.version})
}
