## Purpose

JSON-Schnittstelle, über die das Frontend Rezepte liest und Wochenpläne liest und ändert. Sie definiert ein stabiles Datenschema und ein einheitliches Fehlerverhalten.

## ADDED Requirements

### Requirement: Rezepte abrufen
Das System SHALL unter `GET /api/recipes` alle Rezepte als JSON-Array liefern, nach Titel sortiert. Unter `GET /api/recipes/{id}` MUST ein einzelnes Rezept geliefert werden. Jedes Rezept MUST `id`, `title` und `source` enthalten, wobei `source.kind` den Wert `pdf` oder `web` hat. Die Felder `imageUrl`, `servings`, `ingredients` und `instructions` MUST fehlen, wenn keine Angabe vorhanden ist.

#### Scenario: Liste
- **WHEN** ein Client `GET /api/recipes` aufruft
- **THEN** antwortet das System mit Status 200 und einem nach Titel sortierten Array von Rezepten

#### Scenario: Unbekannte ID
- **WHEN** ein Client `GET /api/recipes/does-not-exist` aufruft
- **THEN** antwortet das System mit Status 404 und einem Fehlerobjekt

### Requirement: Wochenplan abrufen
Das System SHALL unter `GET /api/weeks/{week}` den Plan einer ISO-Kalenderwoche liefern, wobei `{week}` die Form `YYYY-Www` hat, zum Beispiel `2026-W40`. Die Antwort MUST alle sieben Tage der Woche als ISO-Datum enthalten. Nicht belegte Tage MUST den Wert `null` haben.

#### Scenario: Woche ohne Planung
- **WHEN** ein Client `GET /api/weeks/2026-W41` für eine Woche ohne Einträge aufruft
- **THEN** antwortet das System mit Status 200, `week: "2026-W41"` und sieben Tagen von `2026-10-05` bis `2026-10-11`, alle mit `null`

#### Scenario: Ungültige Woche
- **WHEN** ein Client `GET /api/weeks/2026-W60` oder `GET /api/weeks/abc` aufruft
- **THEN** antwortet das System mit Status 400 und einem Fehlerobjekt

### Requirement: Tag im Wochenplan setzen
Das System SHALL unter `PUT /api/days/{date}` mit dem Body `{"recipeId": "<id>"}` einem Tag ein Rezept zuordnen. Mit `{"recipeId": null}` MUST die Zuordnung entfernt werden. Die Antwort MUST den vollständigen, aktualisierten Plan der Woche enthalten, zu der das Datum gehört.

#### Scenario: Zuordnen
- **WHEN** ein Client `PUT /api/days/2026-09-30` mit einer existierenden `recipeId` sendet
- **THEN** antwortet das System mit Status 200 und dem Plan von `2026-W40`, in dem der 30.09. dieses Rezept enthält

#### Scenario: Unbekanntes Rezept
- **WHEN** die `recipeId` nicht existiert
- **THEN** antwortet das System mit Status 422, und der Plan bleibt unverändert

#### Scenario: Ungültiges Datum oder ungültiger Body
- **WHEN** das Datum nicht die Form `YYYY-MM-DD` hat oder kein gültiges Kalenderdatum ist (zum Beispiel `2026-02-30`), oder der Body kein gültiges JSON ist
- **THEN** antwortet das System mit Status 400, und der Plan bleibt unverändert

### Requirement: Einheitliche Fehlerantworten
Jede Fehlerantwort der API SHALL den Content-Type `application/json` und die Form `{"error": "<Meldung>"}` haben. Interne Fehler MUST mit Status 500 beantwortet werden, ohne technische Details wie Stacktraces oder SQL preiszugeben.

#### Scenario: Interner Fehler
- **WHEN** die Datenbank beim Lesen einen Fehler meldet
- **THEN** antwortet das System mit Status 500 und `{"error": "internal error"}`, und der Fehler wird serverseitig protokolliert
