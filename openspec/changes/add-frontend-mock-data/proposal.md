## Why

Der Essenplaner wird neu aufgebaut. Damit wir Bedienung und Datenmodell früh am echten UI prüfen können, entsteht zuerst das Frontend. Es arbeitet mit Dummy-Daten aus JSON-Dateien und braucht noch kein Backend.

## What Changes

- Neues React-/TypeScript-Frontend unter `frontend/` (Vite), mobil zuerst gestaltet
- Wochenansicht pro Kalenderwoche (Montag bis Sonntag, mit Datum), mit Blättern zur vorherigen und nächsten Woche und Sprung zur aktuellen Woche
- Pro Tag ein Rezept auswählen, ändern oder entfernen
- Rezeptliste mit Suche nach Titel und einer Detailansicht (Titel, Bild, Zutaten, Quelle als PDF oder Webseite)
- Dummy-Daten liegen als JSON-Dateien vor: Rezepte und Wochenpläne. Sie werden über eine eigene Datenzugriffsschicht geladen, die später gegen die Backend-API getauscht wird.
- Übernommen aus dem Prototyp `family-dinner-planner`: Wochentagstypen, deutsche Bezeichnungen, Rezeptauswahl-Dialog, Fetch-Wrapper

## Capabilities

### New Capabilities
- `meal-plan`: Wochenplan pro Kalenderwoche ansehen, zwischen Wochen wechseln, Rezepte Tagen zuordnen und entfernen
- `recipe-catalog`: verfügbare Rezepte auflisten, durchsuchen und im Detail ansehen, inklusive Link zur Quelle

### Modified Capabilities
<!-- keine -->

## Impact

- Neuer Ordner `frontend/` mit eigenen npm-Abhängigkeiten (React, Vite, Vitest)
- Dummy-Daten unter `frontend/public/mock/`
- Kein Backend und keine Speicherung: Änderungen am Plan gehen beim Neuladen verloren. Das behebt `add-go-backend`.
