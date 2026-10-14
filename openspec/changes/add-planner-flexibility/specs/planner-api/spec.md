## MODIFIED Requirements

### Requirement: Wochenplan abrufen
Das System SHALL unter `GET /api/weeks/{week}` den Plan einer ISO-Kalenderwoche liefern, wobei `{week}` die Form `YYYY-Www` hat, zum Beispiel `2026-W40`. Die Antwort MUST alle sieben Tage der Woche als ISO-Datum enthalten, jeweils mit einer Liste von Einträgen, auch wenn sie leer ist. Jeder Eintrag MUST `id`, `meal` (`breakfast`, `lunch`, `dinner` oder `snack`), `position` und `kind` (`recipe`, `note`, `item` oder `leftover`) enthalten. Rezept- und Reste-Einträge MUST `recipeId` und, falls gesetzt, `servings` enthalten, Reste-Einträge zusätzlich `leftoverOf` mit ID und Datum des Originals. Notizen und Einzelzutaten MUST `text` enthalten. Die Einträge MUST nach Mahlzeit und `position` sortiert sein, unabhängig davon, welche Mahlzeiten sichtbar sind.

#### Scenario: Woche ohne Planung
- **WHEN** ein Client `GET /api/weeks/2026-W41` für eine Woche ohne Einträge aufruft
- **THEN** antwortet das System mit Status 200, `week: "2026-W41"` und sieben Tagen von `2026-10-05` bis `2026-10-11`, alle mit leerer Liste

#### Scenario: Ungültige Woche
- **WHEN** ein Client `GET /api/weeks/2026-W60` oder `GET /api/weeks/abc` aufruft
- **THEN** antwortet das System mit Status 400 und einem Fehlerobjekt

## ADDED Requirements

### Requirement: Planeinträge anlegen, ändern und löschen
Das System SHALL unter `POST /api/entries` einen Eintrag mit `date`, `meal`, `kind` und den zur Art passenden Feldern anlegen. Unter `PATCH /api/entries/{id}` MUST es `date`, `meal`, `servings` und `text` ändern und unter `DELETE /api/entries/{id}` den Eintrag löschen. Die Antwort jeder dieser Anfragen MUST den vollständigen Plan aller Wochen enthalten, die von der Änderung betroffen sind (bei einem Verschieben in eine andere Woche beide). Ein Eintrag der Art `recipe` MUST auf ein verfügbares Rezept verweisen, sonst antwortet das System mit 422. Ein Eintrag der Art `leftover` MUST auf einen Rezepteintrag verweisen, sonst antwortet das System mit 422. `text` MUST für Notizen und Einzelzutaten 1 bis 200 Zeichen lang sein. Ein neuer Eintrag MUST ans Ende seiner Mahlzeit gestellt werden.

#### Scenario: Anlegen
- **WHEN** ein Client `POST /api/entries` mit `{"date": "2026-09-30", "meal": "dinner", "kind": "recipe", "recipeId": "linsensuppe"}` sendet
- **THEN** antwortet das System mit 201 und dem Plan von `2026-W40`, in dem der 30.09. diesen Eintrag mit `servings: 6` enthält

#### Scenario: Unbekanntes Rezept
- **WHEN** die `recipeId` nicht existiert oder das Rezept nicht mehr verfügbar ist
- **THEN** antwortet das System mit 422, und der Plan bleibt unverändert

#### Scenario: Verschieben in andere Woche
- **WHEN** ein Client `PATCH /api/entries/{id}` mit einem Datum der Folgewoche sendet
- **THEN** antwortet das System mit 200 und den Plänen beider Wochen

#### Scenario: Ungültige Eingaben
- **WHEN** das Datum kein gültiges Kalenderdatum ist, `meal` oder `kind` unbekannt ist oder der Body kein gültiges JSON ist
- **THEN** antwortet das System mit Status 400, und der Plan bleibt unverändert

#### Scenario: Unbekannter Eintrag
- **WHEN** ein Client `DELETE /api/entries/does-not-exist` aufruft
- **THEN** antwortet das System mit 404

### Requirement: Woche kopieren über die API
Das System SHALL unter `POST /api/weeks/{week}/copy` mit dem Body `{"to": "<Woche>", "mode": "append" | "replace"}` alle Einträge einer Woche in die Zielwoche kopieren. Die Antwort MUST den Plan der Zielwoche und die Anzahl übersprungener Einträge (`skipped`) enthalten. Quelle und Ziel MUST verschieden sein, sonst antwortet das System mit 422. Der Vorgang MUST ganz oder gar nicht ausgeführt werden.

#### Scenario: Kopieren
- **WHEN** ein Client `POST /api/weeks/2026-W40/copy` mit `{"to": "2026-W42", "mode": "append"}` sendet
- **THEN** antwortet das System mit 200, dem Plan von `2026-W42` und `skipped: 0`

### Requirement: Planungsverlauf abrufen
Das System SHALL unter `GET /api/recipes/{id}/history` die Daten aller Rezepteinträge dieses Rezepts liefern, neueste zuerst, ohne Reste-Einträge.

#### Scenario: Verlauf
- **WHEN** ein Client den Verlauf eines zweimal geplanten Rezepts abruft
- **THEN** antwortet das System mit 200 und `{"dates": ["2026-10-16", "2026-10-02"]}`

## REMOVED Requirements

### Requirement: Tag im Wochenplan setzen
**Reason**: Ein Tag hat nicht mehr genau ein Rezept, sondern beliebig viele Einträge in mehreren Mahlzeiten.
**Migration**: Statt `PUT /api/days/{date}` mit `{"recipeId": …}` legt ein Client mit `POST /api/entries` einen Eintrag an und entfernt ihn mit `DELETE /api/entries/{id}`. Das einzige betroffene Programm ist das eigene Frontend, das in derselben Change umgestellt wird.
