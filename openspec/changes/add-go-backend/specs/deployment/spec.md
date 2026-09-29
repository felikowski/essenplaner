## Purpose

Legt fest, wie der Essenplaner betrieben wird: ein einzelnes Programm, das per Umgebungsvariablen konfiguriert wird und seine Daten dauerhaft ablegt.

## ADDED Requirements

### Requirement: Ein Binary liefert API und Frontend
Das System SHALL als ein einzelnes ausführbares Programm laufen, das unter `/api/…` die API und unter allen anderen Pfaden das gebaute Frontend ausliefert. Pfade ohne passende Datei MUST mit der `index.html` des Frontends beantwortet werden, damit Deep-Links wie `/woche/2026-W40` funktionieren. Unbekannte Pfade unter `/api/` MUST mit Status 404 und einem JSON-Fehler beantwortet werden.

#### Scenario: Deep-Link
- **WHEN** ein Browser `/rezepte/abc` direkt aufruft
- **THEN** liefert das System die `index.html` des Frontends mit Status 200

#### Scenario: Unbekannter API-Pfad
- **WHEN** ein Client `/api/gibtsnicht` aufruft
- **THEN** antwortet das System mit Status 404 und `{"error": "not found"}`

### Requirement: Konfiguration über Umgebungsvariablen
Das System SHALL Port und Datenbankpfad aus Umgebungsvariablen lesen und MUST für beides sinnvolle Standardwerte für die lokale Entwicklung haben.

#### Scenario: Standardwerte
- **WHEN** das Programm ohne Umgebungsvariablen gestartet wird
- **THEN** lauscht es auf Port 8080 und verwendet `./data/essenplaner.db`

### Requirement: Daten überleben Neustarts
Das System SHALL Rezepte und Wochenpläne dauerhaft speichern. Nach einem Neustart MUST derselbe Stand vorhanden sein. Beim ersten Start mit leerer Datenbank MUST das Datenbankschema automatisch angelegt werden.

#### Scenario: Neustart
- **WHEN** ein Tag belegt und das Programm danach neu gestartet wird
- **THEN** liefert `GET /api/weeks/{week}` diese Belegung weiterhin

### Requirement: Health-Check
Das System SHALL unter `GET /healthz` den Status 200 liefern, wenn es Anfragen bedienen kann und die Datenbank erreichbar ist. Andernfalls MUST es Status 503 liefern.

#### Scenario: Gesund
- **WHEN** ein Monitoring-System `GET /healthz` aufruft und die Datenbank erreichbar ist
- **THEN** antwortet das System mit Status 200
