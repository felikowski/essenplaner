# recipe-catalog Specification

## Purpose

Alle Rezepte der Familie an einem Ort: durchsuchbar und mit Details, egal ob sie aus einer PDF oder von einer Rezeptseite stammen.

## Requirements

### Requirement: Rezeptliste
Das System SHALL alle verfügbaren Rezepte alphabetisch nach Titel sortiert auflisten. Jedes Rezept MUST mit Titel und Art der Quelle angezeigt werden (PDF, Webseite oder Eigenes Rezept). Ein Vorschaubild MUST angezeigt werden, wenn eines vorhanden ist. Die Liste MUST eine Aktion „Neues Rezept“ anbieten.

#### Scenario: Liste anzeigen
- **WHEN** der Nutzer die Rezeptliste öffnet
- **THEN** sieht er alle Rezepte alphabetisch sortiert, jeweils mit Titel und Quellenart

#### Scenario: Keine Rezepte
- **WHEN** keine Rezepte vorhanden sind
- **THEN** zeigt das System einen Hinweis statt einer leeren Fläche und bietet „Neues Rezept“ an

#### Scenario: Eigenes Rezept
- **WHEN** die Liste ein selbst angelegtes Rezept enthält
- **THEN** ist es als „Eigenes Rezept“ gekennzeichnet

### Requirement: Rezepte suchen
Das System SHALL die Rezeptliste nach einem Suchbegriff filtern. Dabei MUST der Titel durchsucht werden, ohne Beachtung von Groß- und Kleinschreibung. Die Suche MUST sowohl in der Rezeptliste als auch im Auswahldialog des Wochenplans verfügbar sein.

#### Scenario: Treffer
- **WHEN** der Nutzer „curry“ eingibt
- **THEN** zeigt das System nur Rezepte, deren Titel „curry“ enthält, zum Beispiel „Hähnchen-Curry“

#### Scenario: Kein Treffer
- **WHEN** kein Rezept zum Suchbegriff passt
- **THEN** zeigt das System „Keine Rezepte gefunden“

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

### Requirement: Nicht mehr verfügbare Rezepte
Das System SHALL Rezepte, die entfernt wurden oder deren Quelle nicht mehr existiert, als nicht mehr verfügbar kennzeichnen (`available: false`). Sie MUST dabei nicht gelöscht werden. Sie MUST nicht in der Rezeptliste und nicht im Auswahldialog erscheinen. In bereits geplanten Tagen und in ihrer Detailansicht MUST ihr Titel mit dem Hinweis „Nicht mehr verfügbar“ angezeigt werden. Ein nicht mehr verfügbares Rezept MUST sich nicht erneut einplanen lassen.

#### Scenario: Im Plan
- **WHEN** ein eingeplantes Rezept nicht mehr verfügbar ist
- **THEN** zeigt der Tag den Titel mit dem Hinweis „Nicht mehr verfügbar“

#### Scenario: Neu zuordnen
- **WHEN** ein Client `POST /api/entries` mit einem Rezepteintrag für ein nicht mehr verfügbares Rezept sendet
- **THEN** antwortet das System mit 422
