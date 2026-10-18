package auth

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/felikowski/essenplaner/backend/internal/config"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

const testPublicURL = "https://essenplaner.example"

type testEnv struct {
	t        *testing.T
	provider *fakeProvider
	service  *Service
	db       *store.DB
	handler  http.Handler
	now      time.Time
}

func newTestEnv(t *testing.T, allowed ...string) *testEnv {
	t.Helper()
	if len(allowed) == 0 {
		allowed = []string{"auth0|anna"}
	}
	db, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	env := &testEnv{t: t, db: db, now: time.Now().UTC().Truncate(time.Second)}
	env.provider = newFakeProvider(t, "client-id")
	cfg := config.Auth{Domain: "unused.example", ClientID: "client-id", ClientSecret: "secret", PublicURL: testPublicURL, AllowedSubjects: allowed}
	env.service = New(cfg, db, slog.New(slog.NewTextHandler(io.Discard, nil)), Options{
		Issuer: env.provider.issuer(),
		Now:    func() time.Time { return env.now },
	})

	mux := http.NewServeMux()
	env.service.Register(mux)
	mux.HandleFunc("GET /api/recipes", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, http.StatusOK, []string{}) })
	mux.HandleFunc("POST /api/entries", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusCreated) })
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "<html>") })
	env.handler = env.service.Protect(mux)
	return env
}

func (e *testEnv) do(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	return rec
}

func cookieFrom(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// startLogin ruft /api/auth/login auf und liefert die Weiterleitung zu Auth0 und das Login-Cookie.
func (e *testEnv) startLogin(returnTo string) (*url.URL, *http.Cookie) {
	e.t.Helper()
	rec := e.do(httptest.NewRequest("GET", "/api/auth/login?returnTo="+url.QueryEscape(returnTo), nil))
	if rec.Code != http.StatusFound {
		e.t.Fatalf("login: status %d", rec.Code)
	}
	location, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		e.t.Fatal(err)
	}
	cookie := cookieFrom(rec, loginCookieName)
	if cookie == nil {
		e.t.Fatal("login: kein login-cookie")
	}
	return location, cookie
}

// login durchläuft den ganzen Ablauf. Als Code dient die nonce aus der Weiterleitung (der Fake schreibt
// sie ins ID-Token), so kommt eine passende nonce zurück, ohne Zustand im Fake.
func (e *testEnv) login(returnTo string, claims map[string]any) *httptest.ResponseRecorder {
	e.t.Helper()
	location, cookie := e.startLogin(returnTo)
	q := location.Query()
	e.provider.expect(q.Get("code_challenge"), claims)
	callback := httptest.NewRequest("GET", "/api/auth/callback?code="+url.QueryEscape(q.Get("nonce"))+"&state="+url.QueryEscape(q.Get("state")), nil)
	callback.AddCookie(cookie)
	return e.do(callback)
}

func (e *testEnv) loggedInCookie() *http.Cookie {
	e.t.Helper()
	rec := e.login("/", map[string]any{"sub": "auth0|anna", "name": "Anna"})
	c := cookieFrom(rec, sessionCookieName)
	if c == nil {
		e.t.Fatalf("keine sitzung: status %d, location %s", rec.Code, rec.Header().Get("Location"))
	}
	return c
}

func TestLoginRedirectsToAuth0WithPKCE(t *testing.T) {
	env := newTestEnv(t)
	location, cookie := env.startLogin("/woche/2026-W40")
	q := location.Query()
	if !strings.HasPrefix(location.String(), env.provider.server.URL+"/authorize") {
		t.Errorf("ziel = %s", location)
	}
	for _, key := range []string{"state", "nonce", "code_challenge"} {
		if q.Get(key) == "" {
			t.Errorf("parameter %s fehlt", key)
		}
	}
	if q.Get("code_challenge_method") != "S256" || q.Get("redirect_uri") != testPublicURL+"/api/auth/callback" ||
		q.Get("client_id") != "client-id" || q.Get("scope") != "openid profile email" {
		t.Errorf("parameter = %v", q)
	}
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != loginCookiePath {
		t.Errorf("login-cookie = %+v", cookie)
	}
}

func TestSafeReturnTo(t *testing.T) {
	cases := map[string]string{
		"/woche/2026-W40":      "/woche/2026-W40",
		"/rezepte?tag=suppe":   "/rezepte?tag=suppe",
		"":                     "/",
		"//evil.example":       "/",
		`/\evil.example`:       "/",
		"https://evil.example": "/",
		"evil":                 "/",
		"/login?fehler=x":      "/",
		"/api/recipes":         "/",
	}
	for in, want := range cases {
		if got := SafeReturnTo(in); got != want {
			t.Errorf("SafeReturnTo(%q) = %q, erwartet %q", in, got, want)
		}
	}
}

func TestCallbackSuccess(t *testing.T) {
	env := newTestEnv(t)
	rec := env.login("/woche/2026-W40", map[string]any{"sub": "auth0|anna", "name": "Anna", "email": "anna@example.com", "picture": "https://img/anna.png"})
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "/woche/2026-W40" {
		t.Fatalf("status %d, location %q", rec.Code, rec.Header().Get("Location"))
	}
	session := cookieFrom(rec, sessionCookieName)
	if session == nil || !session.HttpOnly || !session.Secure || session.SameSite != http.SameSiteLaxMode || session.Path != "/" {
		t.Fatalf("sitzungs-cookie = %+v", session)
	}
	if login := cookieFrom(rec, loginCookieName); login == nil || login.MaxAge >= 0 {
		t.Errorf("login-cookie nicht gelöscht: %+v", login)
	}

	req := httptest.NewRequest("GET", "/api/me", nil)
	req.AddCookie(session)
	me := env.do(req)
	if me.Code != http.StatusOK || strings.TrimSpace(me.Body.String()) != `{"name":"Anna","email":"anna@example.com","picture":"https://img/anna.png"}` {
		t.Errorf("/api/me: %d %s", me.Code, me.Body.String())
	}
}

func TestCallbackAcceptsAccountWithoutVerifiedEmail(t *testing.T) {
	env := newTestEnv(t)
	for _, claims := range []map[string]any{
		{"sub": "auth0|anna", "email": "anna@example.com", "email_verified": false, "nickname": "anna"},
		{"sub": "auth0|anna", "preferred_username": "anna"},
	} {
		rec := env.login("/", claims)
		if cookieFrom(rec, sessionCookieName) == nil {
			t.Errorf("claims %v: keine sitzung, location %s", claims, rec.Header().Get("Location"))
		}
	}
}

func TestDisplayName(t *testing.T) {
	cases := []struct {
		claims idClaims
		want   string
	}{
		{idClaims{Name: "Anna Glöckner", Nickname: "anna"}, "Anna Glöckner"},
		{idClaims{Name: "anna@example.com", Email: "anna@example.com", Nickname: "anna"}, "anna"},
		{idClaims{PreferredUsername: "anna", Nickname: "a"}, "anna"},
		{idClaims{Email: "anna@example.com"}, "anna@example.com"},
	}
	for _, c := range cases {
		if got := c.claims.displayName(); got != c.want {
			t.Errorf("%+v: %q, erwartet %q", c.claims, got, c.want)
		}
	}
}

func TestCallbackRejectsSubjectNotAllowed(t *testing.T) {
	env := newTestEnv(t)
	rec := env.login("/", map[string]any{"sub": "auth0|ibiza-gast", "name": "Gast"})
	if rec.Header().Get("Location") != "/login?fehler="+ErrorNoAccess || cookieFrom(rec, sessionCookieName) != nil {
		t.Errorf("status %d, location %q", rec.Code, rec.Header().Get("Location"))
	}
}

func TestCallbackWrongState(t *testing.T) {
	env := newTestEnv(t)
	location, cookie := env.startLogin("/")
	q := location.Query()
	env.provider.expect(q.Get("code_challenge"), map[string]any{"sub": "auth0|anna"})
	req := httptest.NewRequest("GET", "/api/auth/callback?code="+url.QueryEscape(q.Get("nonce"))+"&state=falsch", nil)
	req.AddCookie(cookie)
	rec := env.do(req)
	if rec.Header().Get("Location") != "/login?fehler="+ErrorFailed || cookieFrom(rec, sessionCookieName) != nil {
		t.Errorf("location %q", rec.Header().Get("Location"))
	}

	// Ohne Login-Cookie (etwa nach Ablauf) ebenso.
	req = httptest.NewRequest("GET", "/api/auth/callback?code=x&state="+url.QueryEscape(q.Get("state")), nil)
	if rec := env.do(req); rec.Header().Get("Location") != "/login?fehler="+ErrorFailed {
		t.Errorf("ohne cookie: location %q", rec.Header().Get("Location"))
	}
}

func TestCallbackWrongNonce(t *testing.T) {
	env := newTestEnv(t)
	env.provider.nonce = "andere-nonce"
	rec := env.login("/", map[string]any{"sub": "auth0|anna"})
	if rec.Header().Get("Location") != "/login?fehler="+ErrorFailed || cookieFrom(rec, sessionCookieName) != nil {
		t.Errorf("location %q", rec.Header().Get("Location"))
	}
}

func TestCallbackAuth0Error(t *testing.T) {
	env := newTestEnv(t)
	for code, want := range map[string]string{"access_denied": ErrorCancelled, "server_error": ErrorFailed} {
		rec := env.do(httptest.NewRequest("GET", "/api/auth/callback?error="+code+"&error_description=%3Cscript%3E", nil))
		if rec.Header().Get("Location") != "/login?fehler="+want || cookieFrom(rec, sessionCookieName) != nil {
			t.Errorf("%s: location %q", code, rec.Header().Get("Location"))
		}
	}
}

func TestLogout(t *testing.T) {
	env := newTestEnv(t)
	session := env.loggedInCookie()

	req := httptest.NewRequest("POST", "/api/auth/logout", nil)
	req.Header.Set("Origin", testPublicURL)
	req.AddCookie(session)
	rec := env.do(req)
	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status %d", rec.Code)
	}
	want := env.provider.server.URL + "/oidc/logout?client_id=client-id&post_logout_redirect_uri=" + url.QueryEscape(testPublicURL+"/login")
	if rec.Header().Get("Location") != want {
		t.Errorf("location %q, erwartet %q", rec.Header().Get("Location"), want)
	}
	if c := cookieFrom(rec, sessionCookieName); c == nil || c.MaxAge >= 0 {
		t.Errorf("cookie nicht gelöscht: %+v", c)
	}

	me := httptest.NewRequest("GET", "/api/me", nil)
	me.AddCookie(session)
	if rec := env.do(me); rec.Code != http.StatusUnauthorized {
		t.Errorf("alte sitzung nach logout: %d", rec.Code)
	}
}

func TestProtect(t *testing.T) {
	env := newTestEnv(t)

	rec := env.do(httptest.NewRequest("GET", "/api/recipes", nil))
	if rec.Code != http.StatusUnauthorized || strings.TrimSpace(rec.Body.String()) != `{"error":"unauthorized"}` {
		t.Errorf("ohne cookie: %d %s", rec.Code, rec.Body.String())
	}
	bogus := httptest.NewRequest("GET", "/api/recipes", nil)
	bogus.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "erfunden"})
	if rec := env.do(bogus); rec.Code != http.StatusUnauthorized {
		t.Errorf("erfundene sitzung: %d", rec.Code)
	}

	session := env.loggedInCookie()
	req := httptest.NewRequest("GET", "/api/recipes", nil)
	req.AddCookie(session)
	if rec := env.do(req); rec.Code != http.StatusOK {
		t.Errorf("mit sitzung: %d", rec.Code)
	}

	for _, path := range []string{"/healthz", "/", "/woche/2026-W40", "/login"} {
		if rec := env.do(httptest.NewRequest("GET", path, nil)); rec.Code != http.StatusOK {
			t.Errorf("%s ohne sitzung: %d", path, rec.Code)
		}
	}
}

func TestProtectRejectsRemovedSubject(t *testing.T) {
	env := newTestEnv(t)
	session := env.loggedInCookie()

	// Neustart mit einer Freigabeliste ohne Anna: dieselbe Datenbank, neuer Dienst.
	cfg := env.service.cfg
	cfg.AllowedSubjects = []string{"auth0|ben"}
	restarted := New(cfg, env.db, env.service.logger, Options{Issuer: env.provider.issuer(), Now: env.service.now})
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/recipes", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	req := httptest.NewRequest("GET", "/api/recipes", nil)
	req.AddCookie(session)
	rec := httptest.NewRecorder()
	restarted.Protect(mux).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("entfernte ID: %d", rec.Code)
	}
}

func TestSessionTouchedAtMostHourly(t *testing.T) {
	env := newTestEnv(t)
	session := env.loggedInCookie()
	request := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", "/api/recipes", nil)
		req.AddCookie(session)
		return env.do(req)
	}

	env.now = env.now.Add(30 * time.Minute)
	if rec := request(); cookieFrom(rec, sessionCookieName) != nil {
		t.Error("nach 30 minuten schon erneuert")
	}
	env.now = env.now.Add(31 * time.Minute)
	if rec := request(); cookieFrom(rec, sessionCookieName) == nil {
		t.Error("nach über einer stunde nicht erneuert")
	}
	// 29 Tage später ist die Sitzung dank Aktualisierung noch gültig, 31 Tage danach nicht mehr.
	env.now = env.now.Add(29 * 24 * time.Hour)
	if rec := request(); rec.Code != http.StatusOK {
		t.Errorf("nach 29 tagen: %d", rec.Code)
	}
	env.now = env.now.Add(31 * 24 * time.Hour)
	if rec := request(); rec.Code != http.StatusUnauthorized {
		t.Errorf("nach 31 tagen inaktivität: %d", rec.Code)
	}
}

func TestOriginCheck(t *testing.T) {
	env := newTestEnv(t)
	session := env.loggedInCookie()
	post := func(headers map[string]string) int {
		req := httptest.NewRequest("POST", "/api/entries", nil)
		req.AddCookie(session)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		return env.do(req).Code
	}

	if code := post(map[string]string{"Origin": "https://evil.example"}); code != http.StatusForbidden {
		t.Errorf("fremde origin: %d", code)
	}
	if code := post(map[string]string{"Origin": testPublicURL}); code != http.StatusCreated {
		t.Errorf("eigene origin: %d", code)
	}
	if code := post(map[string]string{"Sec-Fetch-Site": "same-origin"}); code != http.StatusCreated {
		t.Errorf("sec-fetch-site same-origin: %d", code)
	}
	if code := post(map[string]string{"Sec-Fetch-Site": "cross-site"}); code != http.StatusForbidden {
		t.Errorf("sec-fetch-site cross-site: %d", code)
	}
	if code := post(nil); code != http.StatusForbidden {
		t.Errorf("ohne origin-header: %d", code)
	}
}

func TestCookiesInsecureOnlyForLocalhost(t *testing.T) {
	if !secureCookies("https://essenplaner.example") || secureCookies("http://localhost:5173") {
		t.Error("secure-flag falsch")
	}
}
