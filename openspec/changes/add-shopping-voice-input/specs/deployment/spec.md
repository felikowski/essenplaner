## ADDED Requirements

### Requirement: Sprachdienst optional konfigurieren
Das System SHALL den Schlüssel für den Sprachdienst aus der Umgebungsvariable `OPENAI_API_KEY` lesen. Fehlt sie, MUST das System normal starten und nur die Spracheingabe abschalten. Die verwendeten Modelle MUST sich über Umgebungsvariablen ändern lassen und sinnvolle Standardwerte haben. Der Schlüssel MUST wie alle Anwendungsgeheimnisse nur auf dem Server liegen und MUST NOT an den Browser ausgeliefert werden.

#### Scenario: Ohne Schlüssel
- **WHEN** das Programm ohne `OPENAI_API_KEY` startet
- **THEN** läuft es wie bisher, und `GET /api/shopping/voice` meldet die Spracheingabe als nicht verfügbar

#### Scenario: Schlüssel nicht im Browser
- **WHEN** jemand die ausgelieferten Frontend-Dateien und alle API-Antworten untersucht
- **THEN** findet er darin den Schlüssel nicht
