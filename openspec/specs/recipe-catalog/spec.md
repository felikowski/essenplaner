# recipe-catalog Specification

## Purpose

Alle Rezepte der Familie an einem Ort: durchsuchbar und mit Details, egal ob sie aus einer PDF oder von einer Rezeptseite stammen.

## Requirements

### Requirement: Rezeptliste
Das System SHALL alle verfügbaren Rezepte alphabetisch nach Titel sortiert auflisten. Jedes Rezept MUST mit Titel und Art der Quelle angezeigt werden (PDF oder Webseite). Ein Vorschaubild MUST angezeigt werden, wenn eines vorhanden ist.

#### Scenario: Liste anzeigen
- **WHEN** der Nutzer die Rezeptliste öffnet
- **THEN** sieht er alle Rezepte alphabetisch sortiert, jeweils mit Titel und Quellenart

#### Scenario: Keine Rezepte
- **WHEN** keine Rezepte vorhanden sind
- **THEN** zeigt das System einen Hinweis statt einer leeren Fläche

### Requirement: Rezepte suchen
Das System SHALL die Rezeptliste nach einem Suchbegriff filtern. Dabei MUST der Titel durchsucht werden, ohne Beachtung von Groß- und Kleinschreibung. Die Suche MUST sowohl in der Rezeptliste als auch im Auswahldialog des Wochenplans verfügbar sein.

#### Scenario: Treffer
- **WHEN** der Nutzer „curry“ eingibt
- **THEN** zeigt das System nur Rezepte, deren Titel „curry“ enthält, zum Beispiel „Hähnchen-Curry“

#### Scenario: Kein Treffer
- **WHEN** kein Rezept zum Suchbegriff passt
- **THEN** zeigt das System „Keine Rezepte gefunden“

### Requirement: Rezeptdetails
Das System SHALL für ein Rezept eine Detailansicht anbieten. Sie enthält Titel, Bild, Portionen, Zutaten und Zubereitung, soweit diese Angaben vorhanden sind, sowie einen Link zur Quelle. Fehlende Angaben MUST ausgeblendet werden statt leer zu erscheinen.

#### Scenario: Webrezept
- **WHEN** der Nutzer ein Rezept mit Quelle Webseite öffnet
- **THEN** zeigt das System die vorhandenen Angaben und einen Link „Original ansehen“, der die Quellseite in einem neuen Tab öffnet

#### Scenario: PDF-Rezept
- **WHEN** der Nutzer ein Rezept mit Quelle PDF öffnet
- **THEN** zeigt das System den Titel und einen Link „PDF öffnen“

#### Scenario: Unbekanntes Rezept
- **WHEN** der Nutzer eine Detailansicht für ein nicht existierendes Rezept aufruft
- **THEN** zeigt das System „Rezept nicht gefunden“ und einen Weg zurück zur Liste
