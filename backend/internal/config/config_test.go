package config

import (
	"slices"
	"strings"
	"testing"
)

func env(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

// withAuth ergänzt gültige Auth0-Werte, damit die Tests für Port und Datenbank davon unabhängig bleiben.
func withAuth(values map[string]string) map[string]string {
	all := map[string]string{
		"AUTH0_DOMAIN":        "familie.eu.auth0.com",
		"AUTH0_CLIENT_ID":     "client-id",
		"AUTH0_CLIENT_SECRET": "client-secret",
		"PUBLIC_URL":          "https://essenplaner.example",
		"ALLOWED_SUBJECTS":    "auth0|anna, auth0|ben ,",
	}
	for key, value := range values {
		all[key] = value
	}
	return all
}

func TestFromEnvDefaults(t *testing.T) {
	cfg, err := FromEnv(env(withAuth(nil)))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 8080 || cfg.DatabasePath != "./data/essenplaner.db" {
		t.Fatalf("unerwartete Standardwerte: %+v", cfg)
	}
	if cfg.Addr() != ":8080" {
		t.Fatalf("Addr() = %q", cfg.Addr())
	}
}

func TestFromEnvOverrides(t *testing.T) {
	cfg, err := FromEnv(env(withAuth(map[string]string{"PORT": "9000", "DATABASE_PATH": "/data/plan.db"})))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 9000 || cfg.DatabasePath != "/data/plan.db" {
		t.Fatalf("Umgebungsvariablen nicht übernommen: %+v", cfg)
	}
}

func TestFromEnvInvalidPort(t *testing.T) {
	for _, port := range []string{"abc", "0", "70000"} {
		if _, err := FromEnv(env(withAuth(map[string]string{"PORT": port}))); err == nil {
			t.Errorf("PORT=%q: Fehler erwartet", port)
		}
	}
}

func TestFromEnvAuth(t *testing.T) {
	cfg, err := FromEnv(env(withAuth(map[string]string{
		"AUTH0_DOMAIN": "https://familie.eu.auth0.com/",
		"PUBLIC_URL":   "https://essenplaner.example/",
	})))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Auth.Domain != "familie.eu.auth0.com" || cfg.Auth.Issuer() != "https://familie.eu.auth0.com/" {
		t.Errorf("Domain/Issuer: %q %q", cfg.Auth.Domain, cfg.Auth.Issuer())
	}
	if cfg.Auth.PublicURL != "https://essenplaner.example" {
		t.Errorf("PublicURL = %q", cfg.Auth.PublicURL)
	}
	if !slices.Equal(cfg.Auth.AllowedSubjects, []string{"auth0|anna", "auth0|ben"}) {
		t.Errorf("AllowedSubjects = %q", cfg.Auth.AllowedSubjects)
	}
}

func TestFromEnvMissingAuthValue(t *testing.T) {
	for _, name := range []string{"AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "PUBLIC_URL", "ALLOWED_SUBJECTS"} {
		_, err := FromEnv(env(withAuth(map[string]string{name: ""})))
		if err == nil || !strings.Contains(err.Error(), name) {
			t.Errorf("%s fehlt: Fehler mit Variablennamen erwartet, bekommen %v", name, err)
		}
	}
	if _, err := FromEnv(env(withAuth(map[string]string{"ALLOWED_SUBJECTS": " , "}))); err == nil {
		t.Error("ALLOWED_SUBJECTS ohne IDs: Fehler erwartet")
	}
}

func TestFromEnvInvalidPublicURL(t *testing.T) {
	for _, raw := range []string{"essenplaner.example", "http://essenplaner.example", "https://essenplaner.example/app", "ftp://x"} {
		if _, err := FromEnv(env(withAuth(map[string]string{"PUBLIC_URL": raw}))); err == nil {
			t.Errorf("PUBLIC_URL=%q: Fehler erwartet", raw)
		}
	}
	if _, err := FromEnv(env(withAuth(map[string]string{"PUBLIC_URL": "http://localhost:5173"}))); err != nil {
		t.Errorf("http://localhost muss erlaubt sein: %v", err)
	}
}
