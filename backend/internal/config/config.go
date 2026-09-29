// Package config liest die Konfiguration des Servers aus Umgebungsvariablen.
package config

import (
	"fmt"
	"strconv"
)

const (
	DefaultPort         = 8080
	DefaultDatabasePath = "./data/essenplaner.db"
)

type Config struct {
	Port         int
	DatabasePath string
}

// FromEnv liest PORT und DATABASE_PATH über getenv (in main: os.Getenv).
// Nicht gesetzte Variablen fallen auf die Standardwerte für die lokale Entwicklung zurück.
func FromEnv(getenv func(string) string) (Config, error) {
	cfg := Config{Port: DefaultPort, DatabasePath: DefaultDatabasePath}

	if raw := getenv("PORT"); raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil || port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("PORT muss eine Zahl zwischen 1 und 65535 sein, ist aber %q", raw)
		}
		cfg.Port = port
	}
	if raw := getenv("DATABASE_PATH"); raw != "" {
		cfg.DatabasePath = raw
	}
	return cfg, nil
}

func (c Config) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}
