package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
)

// fakeProvider spielt Auth0: Discovery, JWKS und Token-Endpunkt. Der Token-Endpunkt prüft PKCE und
// liefert ein signiertes ID-Token mit den Claims, die der Test vorher festgelegt hat.
type fakeProvider struct {
	t        *testing.T
	server   *httptest.Server
	key      *rsa.PrivateKey
	clientID string

	mu        sync.Mutex
	challenge string         // code_challenge aus der Weiterleitung zum Login
	claims    map[string]any // zusätzliche Claims des nächsten ID-Tokens
	nonce     string         // überschreibt die nonce, wenn gesetzt
}

func newFakeProvider(t *testing.T, clientID string) *fakeProvider {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	p := &fakeProvider{t: t, key: key, clientID: clientID}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"issuer":                                p.issuer(),
			"authorization_endpoint":                p.server.URL + "/authorize",
			"token_endpoint":                        p.server.URL + "/oauth/token",
			"jwks_uri":                              p.server.URL + "/.well-known/jwks.json",
			"id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("GET /.well-known/jwks.json", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, jose.JSONWebKeySet{Keys: []jose.JSONWebKey{
			{Key: &p.key.PublicKey, KeyID: "test", Algorithm: "RS256", Use: "sig"},
		}})
	})
	mux.HandleFunc("POST /oauth/token", p.handleToken)
	p.server = httptest.NewServer(mux)
	t.Cleanup(p.server.Close)
	return p
}

func (p *fakeProvider) issuer() string { return p.server.URL + "/" }

// expect legt die Claims des nächsten Logins fest (sub, name, …) und merkt sich die PKCE-Challenge.
func (p *fakeProvider) expect(challenge string, claims map[string]any) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.challenge = challenge
	p.claims = claims
}

func (p *fakeProvider) handleToken(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	if r.PostForm.Get("client_id") != p.clientID || r.PostForm.Get("client_secret") != "secret" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_client"})
		return
	}
	sum := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
	if base64.RawURLEncoding.EncodeToString(sum[:]) != p.challenge {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_grant"})
		return
	}
	nonce := r.Form.Get("code") // der Test übergibt die nonce als Code, siehe login()
	if p.nonce != "" {
		nonce = p.nonce
	}
	claims := map[string]any{
		"iss":   p.issuer(),
		"aud":   p.clientID,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(time.Hour).Unix(),
		"nonce": nonce,
	}
	for k, v := range p.claims {
		claims[k] = v
	}
	payload, _ := json.Marshal(claims)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: p.key},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "test"))
	if err != nil {
		p.t.Fatal(err)
	}
	signed, err := signer.Sign(payload)
	if err != nil {
		p.t.Fatal(err)
	}
	idToken, _ := signed.CompactSerialize()
	writeJSON(w, http.StatusOK, map[string]any{"access_token": "at", "token_type": "Bearer", "expires_in": 3600, "id_token": idToken})
}
