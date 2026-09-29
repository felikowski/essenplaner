## ADDED Requirements

### Requirement: Nicht mehr verfügbare Rezepte
Das System SHALL Rezepte, deren Quelle nicht mehr existiert, als nicht mehr verfügbar kennzeichnen (`available: false`). Sie MUST nicht in der Rezeptliste und nicht im Auswahldialog erscheinen. In bereits geplanten Tagen und in ihrer Detailansicht MUST ihr Titel mit dem Hinweis „Nicht mehr verfügbar“ angezeigt werden. Ein nicht mehr verfügbares Rezept MUST sich keinem weiteren Tag zuordnen lassen.

#### Scenario: Im Plan
- **WHEN** ein eingeplantes Rezept nicht mehr verfügbar ist
- **THEN** zeigt der Tag den Titel mit dem Hinweis „Nicht mehr verfügbar“

#### Scenario: Neu zuordnen
- **WHEN** ein Client `PUT /api/days/{date}` mit der ID eines nicht mehr verfügbaren Rezepts sendet
- **THEN** antwortet das System mit 422
