package store

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
)

// ErrInvalidSetting: unbekannter Schlüssel oder ungültiger Wert.
type ErrInvalidSetting struct{ Reason string }

func (e ErrInvalidSetting) Error() string { return e.Reason }

// setting beschreibt eine Haushalts-Einstellung: ihren Standardwert und wie ein neuer Wert geprüft wird.
// Spätere Funktionen tragen hier nur neue Schlüssel ein.
type setting struct {
	defaultValue any
	// parse prüft den JSON-Wert und liefert ihn in der Form, die gespeichert und ausgeliefert wird.
	parse func(json.RawMessage) (any, error)
}

var settingsRegistry = map[string]setting{
	"visibleMeals": {
		defaultValue: []string{"dinner"},
		parse: func(raw json.RawMessage) (any, error) {
			var meals []string
			if err := json.Unmarshal(raw, &meals); err != nil {
				return nil, ErrInvalidSetting{"visibleMeals muss eine Liste von Mahlzeiten sein."}
			}
			if len(meals) == 0 {
				return nil, ErrInvalidSetting{"Mindestens eine Mahlzeit muss sichtbar bleiben."}
			}
			// In fester Reihenfolge und ohne Doppelte speichern.
			var ordered []string
			for _, meal := range Meals {
				if slices.Contains(meals, meal) {
					ordered = append(ordered, meal)
				}
			}
			for _, meal := range meals {
				if !IsMeal(meal) {
					return nil, ErrInvalidSetting{fmt.Sprintf("Unbekannte Mahlzeit: %q", meal)}
				}
			}
			return ordered, nil
		},
	},
}

// Settings liefert alle Einstellungen; nicht gespeicherte mit ihrem Standardwert.
func (db *DB) Settings(ctx context.Context) (map[string]any, error) {
	result := make(map[string]any, len(settingsRegistry))
	for key, s := range settingsRegistry {
		result[key] = s.defaultValue
	}
	rows, err := db.sql.QueryContext(ctx, "SELECT key, value_json FROM household_settings")
	if err != nil {
		return nil, fmt.Errorf("einstellungen lesen: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		s, known := settingsRegistry[key]
		if !known {
			continue // Schlüssel aus einer neueren Version
		}
		parsed, err := s.parse(json.RawMessage(value))
		if err != nil {
			continue // ungültig gespeicherter Wert: Standard verwenden
		}
		result[key] = parsed
	}
	return result, rows.Err()
}

// UpdateSettings prüft alle übergebenen Werte und speichert sie nur, wenn alle gültig sind.
func (db *DB) UpdateSettings(ctx context.Context, values map[string]json.RawMessage) (map[string]any, error) {
	parsed := map[string]any{}
	for key, raw := range values {
		s, known := settingsRegistry[key]
		if !known {
			return nil, ErrInvalidSetting{fmt.Sprintf("Unbekannte Einstellung: %q", key)}
		}
		value, err := s.parse(raw)
		if err != nil {
			return nil, err
		}
		parsed[key] = value
	}

	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	for key, value := range parsed {
		data, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO household_settings (key, value_json) VALUES (?, ?)
			 ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json`, key, string(data)); err != nil {
			return nil, fmt.Errorf("einstellung %s speichern: %w", key, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return db.Settings(ctx)
}
