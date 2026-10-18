// Package config liest die Konfiguration des Servers aus Umgebungsvariablen.
package config

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

const (
	DefaultPort         = 8080
	DefaultDatabasePath = "./data/essenplaner.db"
)

type Config struct {
	Port         int
	DatabasePath string
	Auth         Auth
}

// Auth ist die Anmeldung über Auth0. Alle Werte sind Pflicht.
type Auth struct {
	// Domain des Auth0-Tenants (oder eine Custom Domain), ohne Schema, etwa "familie.eu.auth0.com".
	Domain       string
	ClientID     string
	ClientSecret string
	// PublicURL ist die Adresse, unter der Nutzer die App aufrufen, ohne abschließenden Schrägstrich.
	// Callback-URL und Origin-Prüfung hängen allein an ihr, nicht an Host- oder X-Forwarded-Headern.
	PublicURL string
	// AllowedSubjects sind die Auth0-Nutzer-IDs (sub), die Zugriff haben.
	AllowedSubjects []string
}

// Issuer ist der OIDC-Issuer von Auth0; er endet dort mit einem Schrägstrich.
func (a Auth) Issuer() string {
	return "https://" + a.Domain + "/"
}

// FromEnv liest die Konfiguration über getenv (in main: os.Getenv).
// Port und Datenbankpfad fallen auf Standardwerte für die lokale Entwicklung zurück; die Werte für Auth0
// sind Pflicht, damit der Dienst nie ungeschützt startet.
func FromEnv(getenv func(string) string) (Config, error) {
	port, err := PortFromEnv(getenv)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{Port: port, DatabasePath: DefaultDatabasePath}
	if raw := getenv("DATABASE_PATH"); raw != "" {
		cfg.DatabasePath = raw
	}

	auth, err := authFromEnv(getenv)
	if err != nil {
		return Config{}, err
	}
	cfg.Auth = auth
	return cfg, nil
}

// PortFromEnv liest nur PORT. Der Container-Health-Check braucht nicht mehr.
func PortFromEnv(getenv func(string) string) (int, error) {
	raw := getenv("PORT")
	if raw == "" {
		return DefaultPort, nil
	}
	port, err := strconv.Atoi(raw)
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("PORT muss eine Zahl zwischen 1 und 65535 sein, ist aber %q", raw)
	}
	return port, nil
}

func authFromEnv(getenv func(string) string) (Auth, error) {
	for _, name := range []string{"AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "PUBLIC_URL", "ALLOWED_SUBJECTS"} {
		if strings.TrimSpace(getenv(name)) == "" {
			return Auth{}, fmt.Errorf("%s fehlt: ohne Auth0-Konfiguration startet der Essenplaner nicht (siehe docs/auth0-setup.md)", name)
		}
	}

	domain := strings.TrimSpace(getenv("AUTH0_DOMAIN"))
	domain = strings.TrimSuffix(strings.TrimPrefix(domain, "https://"), "/")
	if strings.ContainsAny(domain, "/:") {
		return Auth{}, fmt.Errorf("AUTH0_DOMAIN muss ein Hostname sein, etwa familie.eu.auth0.com, ist aber %q", getenv("AUTH0_DOMAIN"))
	}

	publicURL := strings.TrimSuffix(strings.TrimSpace(getenv("PUBLIC_URL")), "/")
	parsed, err := url.Parse(publicURL)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" || parsed.Path != "" || parsed.RawQuery != "" {
		return Auth{}, fmt.Errorf("PUBLIC_URL muss eine Adresse wie https://essenplaner.example sein, ist aber %q", getenv("PUBLIC_URL"))
	}
	if parsed.Scheme == "http" && parsed.Hostname() != "localhost" {
		return Auth{}, fmt.Errorf("PUBLIC_URL muss https verwenden (http nur für localhost), ist aber %q", publicURL)
	}

	var subjects []string
	for _, subject := range strings.Split(getenv("ALLOWED_SUBJECTS"), ",") {
		if subject = strings.TrimSpace(subject); subject != "" {
			subjects = append(subjects, subject)
		}
	}
	if len(subjects) == 0 {
		return Auth{}, fmt.Errorf("ALLOWED_SUBJECTS fehlt: mindestens eine Auth0-Nutzer-ID angeben")
	}

	return Auth{
		Domain:          domain,
		ClientID:        strings.TrimSpace(getenv("AUTH0_CLIENT_ID")),
		ClientSecret:    strings.TrimSpace(getenv("AUTH0_CLIENT_SECRET")),
		PublicURL:       publicURL,
		AllowedSubjects: subjects,
	}, nil
}

func (c Config) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}
