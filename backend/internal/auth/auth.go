// Package auth meldet Nutzer über Auth0 (OpenID Connect, Authorization Code Flow mit PKCE) an und
// schützt die API mit serverseitigen Sitzungen. Zugriff haben nur freigegebene Auth0-Nutzer-IDs.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"

	"github.com/felikowski/essenplaner/backend/internal/config"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

// Fehlercodes für /login?fehler=…; das Frontend übersetzt sie. Rohe Meldungen von Auth0 gehen nie an den Browser.
const (
	ErrorCancelled = "abgebrochen"
	ErrorNoAccess  = "kein-zugriff"
	ErrorFailed    = "fehlgeschlagen"
)

// touchInterval: last_seen_at wird höchstens so oft aktualisiert.
const touchInterval = time.Hour

// Options sind Einstellungen, die nur Tests ändern.
type Options struct {
	// Issuer ersetzt den aus AUTH0_DOMAIN gebildeten Issuer (Tests: Fake-OIDC-Provider).
	Issuer string
	// HTTPClient für Discovery, JWKS und Token-Austausch.
	HTTPClient *http.Client
	Now        func() time.Time
}

type Service struct {
	cfg      config.Auth
	sessions store.SessionStore
	logger   *slog.Logger
	issuer   string
	client   *http.Client
	now      func() time.Time
	allowed  map[string]bool
	stateKey []byte
	secure   bool

	mu       sync.Mutex
	provider *oidc.Provider
}

func New(cfg config.Auth, sessions store.SessionStore, logger *slog.Logger, opts Options) *Service {
	s := &Service{
		cfg:      cfg,
		sessions: sessions,
		logger:   logger,
		issuer:   cfg.Issuer(),
		client:   http.DefaultClient,
		now:      time.Now,
		allowed:  make(map[string]bool, len(cfg.AllowedSubjects)),
		stateKey: deriveStateKey(cfg.ClientSecret),
		secure:   secureCookies(cfg.PublicURL),
	}
	if opts.Issuer != "" {
		s.issuer = opts.Issuer
	}
	if opts.HTTPClient != nil {
		s.client = opts.HTTPClient
	}
	if opts.Now != nil {
		s.now = opts.Now
	}
	for _, subject := range cfg.AllowedSubjects {
		s.allowed[subject] = true
	}
	return s
}

// Register fügt die Anmelde-Routen hinzu. /api/me liegt hinter der Sitzungsprüfung aus Protect.
func (s *Service) Register(mux interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}) {
	mux.HandleFunc("GET /api/auth/login", s.handleLogin)
	mux.HandleFunc("GET /api/auth/callback", s.handleCallback)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/me", s.handleMe)
}

// providerFor lädt die OIDC-Konfiguration beim ersten Bedarf. So startet der Dienst auch, wenn Auth0
// gerade nicht erreichbar ist, und bestehende Sitzungen laufen weiter.
func (s *Service) providerFor(ctx context.Context) (*oidc.Provider, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.provider != nil {
		return s.provider, nil
	}
	provider, err := oidc.NewProvider(oidc.ClientContext(ctx, s.client), s.issuer)
	if err != nil {
		return nil, err
	}
	s.provider = provider
	return provider, nil
}

func (s *Service) oauthConfig(provider *oidc.Provider) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.cfg.ClientID,
		ClientSecret: s.cfg.ClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  s.cfg.PublicURL + "/api/auth/callback",
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
}

func (s *Service) handleLogin(w http.ResponseWriter, r *http.Request) {
	provider, err := s.providerFor(r.Context())
	if err != nil {
		s.logger.Error("auth0 nicht erreichbar", "err", err)
		s.redirectToLogin(w, r, ErrorFailed)
		return
	}
	state := loginState{
		State:    randomToken(),
		Nonce:    randomToken(),
		Verifier: oauth2.GenerateVerifier(),
		ReturnTo: SafeReturnTo(r.URL.Query().Get("returnTo")),
		Expires:  s.now().Add(loginStateTTL).Unix(),
	}
	s.setLoginCookie(w, state)
	target := s.oauthConfig(provider).AuthCodeURL(state.State, oidc.Nonce(state.Nonce), oauth2.S256ChallengeOption(state.Verifier))
	http.Redirect(w, r, target, http.StatusFound)
}

func (s *Service) handleCallback(w http.ResponseWriter, r *http.Request) {
	s.clearLoginCookie(w)
	query := r.URL.Query()
	if code := query.Get("error"); code != "" {
		s.logger.Info("auth0 meldet fehler am callback", "error", code, "description", query.Get("error_description"))
		if code == "access_denied" {
			s.redirectToLogin(w, r, ErrorCancelled)
		} else {
			s.redirectToLogin(w, r, ErrorFailed)
		}
		return
	}

	state, ok := s.readLoginCookie(r)
	if !ok || !equalTokens(state.State, query.Get("state")) || query.Get("code") == "" {
		s.logger.Info("callback ohne passenden state")
		s.redirectToLogin(w, r, ErrorFailed)
		return
	}

	claims, err := s.exchange(r.Context(), query.Get("code"), state)
	if err != nil {
		s.logger.Error("anmeldung fehlgeschlagen", "err", err)
		s.redirectToLogin(w, r, ErrorFailed)
		return
	}
	if !s.allowed[claims.Subject] {
		s.logger.Info("anmeldung abgewiesen: nicht freigegeben", "subject", claims.Subject)
		s.redirectToLogin(w, r, ErrorNoAccess)
		return
	}

	id := randomToken()
	now := s.now()
	err = s.sessions.CreateSession(r.Context(), hashSessionID(id), store.Session{
		Subject: claims.Subject, Name: claims.displayName(), Email: claims.Email, Picture: claims.Picture,
		CreatedAt: now, LastSeenAt: now,
	})
	if err != nil {
		s.logger.Error("sitzung anlegen", "err", err)
		s.redirectToLogin(w, r, ErrorFailed)
		return
	}
	s.logger.Info("angemeldet", "subject", claims.Subject)
	s.setSessionCookie(w, id)
	http.Redirect(w, r, state.ReturnTo, http.StatusFound)
}

type idClaims struct {
	Subject           string `json:"sub"`
	Name              string `json:"name"`
	Nickname          string `json:"nickname"`
	PreferredUsername string `json:"preferred_username"`
	Email             string `json:"email"`
	Picture           string `json:"picture"`
}

// displayName: Auth0 setzt bei Datenbank-Konten ohne Namen die E-Mail als name; dann lieber den Benutzernamen.
func (c idClaims) displayName() string {
	if c.Name != "" && c.Name != c.Email {
		return c.Name
	}
	for _, candidate := range []string{c.PreferredUsername, c.Nickname, c.Name, c.Email} {
		if candidate != "" {
			return candidate
		}
	}
	return ""
}

// exchange tauscht den Code gegen Tokens und prüft das ID-Token (Signatur, iss, aud, exp, nonce).
// email_verified wird bewusst nicht ausgewertet: Die Konten legt der Administrator an.
func (s *Service) exchange(ctx context.Context, code string, state loginState) (idClaims, error) {
	provider, err := s.providerFor(ctx)
	if err != nil {
		return idClaims{}, err
	}
	ctx = oidc.ClientContext(ctx, s.client)
	token, err := s.oauthConfig(provider).Exchange(ctx, code, oauth2.VerifierOption(state.Verifier))
	if err != nil {
		return idClaims{}, err
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return idClaims{}, errors.New("antwort ohne id_token")
	}
	idToken, err := provider.Verifier(&oidc.Config{ClientID: s.cfg.ClientID, Now: s.now}).Verify(ctx, rawIDToken)
	if err != nil {
		return idClaims{}, err
	}
	if !equalTokens(idToken.Nonce, state.Nonce) {
		return idClaims{}, errors.New("nonce passt nicht")
	}
	var claims idClaims
	if err := idToken.Claims(&claims); err != nil {
		return idClaims{}, err
	}
	if claims.Subject == "" {
		return idClaims{}, errors.New("id_token ohne sub")
	}
	return claims, nil
}

// handleLogout beendet die Sitzung hier und bei Auth0. Das Frontend schickt ein Formular (Navigation),
// damit der Browser der Weiterleitung zu Auth0 folgt.
func (s *Service) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil && cookie.Value != "" {
		if err := s.sessions.DeleteSession(r.Context(), hashSessionID(cookie.Value)); err != nil {
			s.logger.Error("sitzung löschen", "err", err)
		}
	}
	s.clearSessionCookie(w)
	http.Redirect(w, r, s.LogoutURL(), http.StatusSeeOther)
}

// LogoutURL ist der RP-Initiated-Logout von Auth0 mit Rückkehr auf die Login-Seite der App.
func (s *Service) LogoutURL() string {
	q := url.Values{}
	q.Set("client_id", s.cfg.ClientID)
	q.Set("post_logout_redirect_uri", s.cfg.PublicURL+"/login")
	return strings.TrimSuffix(s.issuer, "/") + "/oidc/logout?" + q.Encode()
}

type me struct {
	Name    string `json:"name,omitempty"`
	Email   string `json:"email,omitempty"`
	Picture string `json:"picture,omitempty"`
}

func (s *Service) handleMe(w http.ResponseWriter, r *http.Request) {
	session, ok := SessionFrom(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, me{Name: session.Name, Email: session.Email, Picture: session.Picture})
}

type sessionKey struct{}

// SessionFrom liefert die Sitzung einer Anfrage, die Protect durchgelassen hat.
func SessionFrom(ctx context.Context) (store.Session, bool) {
	session, ok := ctx.Value(sessionKey{}).(store.Session)
	return session, ok
}

// Protect prüft ändernde Anfragen auf die eigene Origin und verlangt für /api/ (außer /api/auth/) eine
// gültige Sitzung eines freigegebenen Kontos. /healthz und das Frontend bleiben offen.
func (s *Service) Protect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.sameOrigin(r) {
			s.logger.Info("fremde origin abgewiesen", "method", r.Method, "path", r.URL.Path, "origin", r.Header.Get("Origin"))
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/api/auth/") {
			next.ServeHTTP(w, r)
			return
		}
		session, ok := s.validSession(w, r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), sessionKey{}, session)))
	})
}

func (s *Service) validSession(w http.ResponseWriter, r *http.Request) (store.Session, bool) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		return store.Session{}, false
	}
	idHash := hashSessionID(cookie.Value)
	now := s.now()
	session, err := s.sessions.GetSession(r.Context(), idHash, now)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			s.logger.Error("sitzung lesen", "err", err)
		}
		s.clearSessionCookie(w)
		return store.Session{}, false
	}
	// Von der Freigabeliste entfernt (und neu gestartet): Sitzung gilt nicht mehr.
	if !s.allowed[session.Subject] {
		if err := s.sessions.DeleteSession(r.Context(), idHash); err != nil {
			s.logger.Error("sitzung löschen", "err", err)
		}
		s.clearSessionCookie(w)
		return store.Session{}, false
	}
	if now.Sub(session.LastSeenAt) >= touchInterval {
		if err := s.sessions.TouchSession(r.Context(), idHash, now); err != nil {
			s.logger.Error("sitzung aktualisieren", "err", err)
		} else {
			s.setSessionCookie(w, cookie.Value)
		}
	}
	return session, true
}

// sameOrigin: GET und HEAD sind immer erlaubt. Sonst muss Origin zu PUBLIC_URL passen; fehlt Origin,
// genügt Sec-Fetch-Site: same-origin. Ohne beide Header wird abgewiesen.
func (s *Service) sameOrigin(r *http.Request) bool {
	switch r.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		return origin == s.cfg.PublicURL
	}
	return r.Header.Get("Sec-Fetch-Site") == "same-origin"
}

func (s *Service) redirectToLogin(w http.ResponseWriter, r *http.Request, code string) {
	http.Redirect(w, r, "/login?fehler="+url.QueryEscape(code), http.StatusFound)
}

// SafeReturnTo lässt nur Pfade der eigenen App zu: beginnend mit "/", nicht mit "//" oder "/\".
func SafeReturnTo(raw string) string {
	if !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") || strings.HasPrefix(raw, `/\`) || strings.ContainsAny(raw, "\r\n") {
		return "/"
	}
	if strings.HasPrefix(raw, "/login") || strings.HasPrefix(raw, "/api/") {
		return "/"
	}
	return raw
}

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand schlägt praktisch nie fehl
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func hashSessionID(id string) string {
	sum := sha256.Sum256([]byte(id))
	return hex.EncodeToString(sum[:])
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
