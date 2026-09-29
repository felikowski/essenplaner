package config

import "testing"

func env(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestFromEnvDefaults(t *testing.T) {
	cfg, err := FromEnv(env(nil))
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
	cfg, err := FromEnv(env(map[string]string{"PORT": "9000", "DATABASE_PATH": "/data/plan.db"}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 9000 || cfg.DatabasePath != "/data/plan.db" {
		t.Fatalf("Umgebungsvariablen nicht übernommen: %+v", cfg)
	}
}

func TestFromEnvInvalidPort(t *testing.T) {
	for _, port := range []string{"abc", "0", "70000"} {
		if _, err := FromEnv(env(map[string]string{"PORT": port})); err == nil {
			t.Errorf("PORT=%q: Fehler erwartet", port)
		}
	}
}
