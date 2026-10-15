## MODIFIED Requirements

### Requirement: Rezeptdetails
Das System SHALL für ein Rezept eine Detailansicht anbieten. Sie enthält Titel, Bild, Portionen, Zutaten und Zubereitung, soweit diese Angaben vorhanden sind, sowie einen Link zur Quelle, wenn es eine gibt. Zutaten MUST mit ihrem eingegebenen Text angezeigt werden, außer der Nutzer hat abweichende Portionen gewählt (siehe `servings-scaling`). Fehlende Angaben MUST ausgeblendet werden statt leer zu erscheinen. Für verfügbare Rezepte MUST die Detailansicht „Bearbeiten“ anbieten. Hat ein Rezept keine Zutaten, MUST sie stattdessen auf „Zutaten nachtragen“ hinweisen.

#### Scenario: Webrezept
- **WHEN** der Nutzer ein Rezept mit Quelle Webseite öffnet
- **THEN** zeigt das System die vorhandenen Angaben und einen Link „Original ansehen“, der die Quellseite in einem neuen Tab öffnet

#### Scenario: PDF-Rezept
- **WHEN** der Nutzer ein Rezept mit Quelle PDF ohne nachgetragene Zutaten öffnet
- **THEN** zeigt das System den Titel, einen Link „PDF öffnen“ und „Zutaten nachtragen“

#### Scenario: Eigenes Rezept
- **WHEN** der Nutzer ein eigenes Rezept öffnet
- **THEN** zeigt das System die vorhandenen Angaben ohne Quellenlink und bietet „Bearbeiten“ und „Entfernen“ an

#### Scenario: Unbekanntes Rezept
- **WHEN** der Nutzer eine Detailansicht für ein nicht existierendes Rezept aufruft
- **THEN** zeigt das System „Rezept nicht gefunden“ und einen Weg zurück zur Liste
