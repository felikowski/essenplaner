package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

const (
	sessionCookieName = "essenplaner_session"
	loginCookieName   = "essenplaner_login"
	loginCookiePath   = "/api/auth/"
	loginStateTTL     = 10 * time.Minute
)

// secureCookies: Das Secure-Flag entfällt nur für die lokale Entwicklung über http://localhost.
func secureCookies(publicURL string) bool {
	return !strings.HasPrefix(publicURL, "http://localhost")
}

func (s *Service) cookie(name, value, path string, maxAge time.Duration) *http.Cookie {
	c := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	}
	switch {
	case maxAge > 0:
		c.MaxAge = int(maxAge.Seconds())
	case maxAge < 0:
		c.MaxAge = -1
	}
	return c
}

func (s *Service) setSessionCookie(w http.ResponseWriter, id string) {
	http.SetCookie(w, s.cookie(sessionCookieName, id, "/", store.SessionMaxIdle))
}

func (s *Service) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, s.cookie(sessionCookieName, "", "/", -1))
}

// loginState überbrückt die Weiterleitung zu Auth0. Das Cookie ist signiert, nicht verschlüsselt:
// state, nonce und PKCE-Verifier sind nur für diesen einen Login gültig.
type loginState struct {
	State    string `json:"s"`
	Nonce    string `json:"n"`
	Verifier string `json:"v"`
	ReturnTo string `json:"r"`
	Expires  int64  `json:"e"`
}

func deriveStateKey(clientSecret string) []byte {
	sum := sha256.Sum256([]byte("essenplaner login state\x00" + clientSecret))
	return sum[:]
}

func (s *Service) sign(payload []byte) string {
	mac := hmac.New(sha256.New, s.stateKey)
	mac.Write(payload)
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *Service) setLoginCookie(w http.ResponseWriter, state loginState) {
	payload, _ := json.Marshal(state)
	value := base64.RawURLEncoding.EncodeToString(payload) + "." + s.sign(payload)
	http.SetCookie(w, s.cookie(loginCookieName, value, loginCookiePath, loginStateTTL))
}

func (s *Service) clearLoginCookie(w http.ResponseWriter) {
	http.SetCookie(w, s.cookie(loginCookieName, "", loginCookiePath, -1))
}

func (s *Service) readLoginCookie(r *http.Request) (loginState, bool) {
	cookie, err := r.Cookie(loginCookieName)
	if err != nil {
		return loginState{}, false
	}
	encoded, signature, ok := strings.Cut(cookie.Value, ".")
	if !ok {
		return loginState{}, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil || !equalTokens(signature, s.sign(payload)) {
		return loginState{}, false
	}
	var state loginState
	if err := json.Unmarshal(payload, &state); err != nil || s.now().Unix() > state.Expires {
		return loginState{}, false
	}
	state.ReturnTo = SafeReturnTo(state.ReturnTo)
	return state, true
}

func equalTokens(a, b string) bool {
	return a != "" && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
