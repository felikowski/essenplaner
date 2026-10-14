## MODIFIED Requirements

### Requirement: Rezeptliste
Das System SHALL alle verfügbaren Rezepte auflisten, standardmäßig alphabetisch nach Titel sortiert. Jedes Rezept MUST mit Titel und Art der Quelle angezeigt werden (PDF, Webseite oder Eigenes Rezept), dazu Bewertung, Zubereitungszeit und bis zu drei Tags, soweit vorhanden. Ein Vorschaubild MUST angezeigt werden, wenn eines vorhanden ist. Die Liste MUST eine Aktion „Neues Rezept“ sowie Filter und Sortierung anbieten.

#### Scenario: Liste anzeigen
- **WHEN** der Nutzer die Rezeptliste öffnet
- **THEN** sieht er alle Rezepte alphabetisch sortiert, jeweils mit Titel und Quellenart

#### Scenario: Keine Rezepte
- **WHEN** keine Rezepte vorhanden sind
- **THEN** zeigt das System einen Hinweis statt einer leeren Fläche und bietet „Neues Rezept“ an

#### Scenario: Eigenes Rezept
- **WHEN** die Liste ein selbst angelegtes Rezept enthält
- **THEN** ist es als „Eigenes Rezept“ gekennzeichnet

#### Scenario: Eingeordnetes Rezept
- **WHEN** ein Rezept 4 Sterne, 30 Minuten und die Tags „schnell“ und „vegetarisch“ hat
- **THEN** zeigt die Liste diese Angaben unter dem Titel

#### Scenario: Filter ohne Treffer
- **WHEN** aktive Filter alle Rezepte ausschließen
- **THEN** zeigt das System „Keine Rezepte passen zu den Filtern“ und bietet „Filter zurücksetzen“ an

### Requirement: Rezepte suchen
Das System SHALL die Rezeptliste nach einem Suchbegriff filtern. Dabei MUST der Titel, die Tags, die Küche und die Zutatennamen durchsucht werden, ohne Beachtung von Groß- und Kleinschreibung. Treffer im Titel MUST vor anderen Treffern stehen. Die Suche MUST sowohl in der Rezeptliste als auch im Auswahldialog des Wochenplans verfügbar sein und sich mit Filtern kombinieren lassen.

#### Scenario: Treffer
- **WHEN** der Nutzer „curry“ eingibt
- **THEN** zeigt das System Rezepte, deren Titel „curry“ enthält, zum Beispiel „Hähnchen-Curry“, vor Rezepten, die nur Currypulver als Zutat haben

#### Scenario: Treffer im Tag
- **WHEN** der Nutzer „vegetarisch“ eingibt
- **THEN** zeigt das System auch Rezepte mit dem Tag „vegetarisch“, deren Titel das Wort nicht enthält

#### Scenario: Kein Treffer
- **WHEN** kein Rezept zum Suchbegriff passt
- **THEN** zeigt das System „Keine Rezepte gefunden“
