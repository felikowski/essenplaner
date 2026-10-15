# servings-scaling Specification

## Purpose
Rezepte für mehr oder weniger Personen kochen: Portionen wählen, Zutatenmengen umrechnen und lesbar runden, und Mengen-Varianten in der Zubereitung (HelloFresh-Schreibweise) auflösen.

## Requirements

### Requirement: Portionen wählen
Das System SHALL in der Rezeptdetailansicht eine Portionenauswahl von 1 bis 99 anbieten, sofern das Rezept Portionen hat. Voreingestellt MUST die Portionenzahl des Rezepts sein, oder die aus dem URL-Parameter `portionen`, wenn er eine Zahl von 1 bis 99 enthält. Eine Änderung der Auswahl MUST den URL-Parameter aktualisieren, ohne einen neuen Eintrag im Browserverlauf anzulegen; entspricht sie den Rezeptportionen, MUST der Parameter entfallen. Die Überschrift der Zutaten MUST dann „Zutaten für N Portionen“ mit den gewählten Portionen lauten. Weicht die Auswahl ab, MUST ein Weg zurück zu den Rezeptportionen angeboten werden. Die Rezeptdaten MUST unverändert bleiben.

#### Scenario: Mehr Portionen
- **WHEN** der Nutzer bei einem Rezept für 2 Portionen zweimal „+“ tippt
- **THEN** steht „Zutaten für 4 Portionen“ über den Zutaten, und die Adresse endet auf `?portionen=4`

#### Scenario: Neu laden
- **WHEN** der Nutzer `/rezepte/haehnchen-curry?portionen=8` öffnet
- **THEN** sind 8 Portionen gewählt und die Mengen umgerechnet

#### Scenario: Ungültiger Parameter
- **WHEN** der Nutzer `/rezepte/haehnchen-curry?portionen=0` öffnet
- **THEN** sind die Portionen des Rezepts gewählt

#### Scenario: Rezept ohne Portionen
- **WHEN** ein Rezept keine Portionen hat
- **THEN** gibt es keine Portionenauswahl, und die Zutaten stehen wie eingegeben da

### Requirement: Zutatenmengen umrechnen
Das System SHALL alle Zutaten mit Menge mit dem Faktor gewählte Portionen geteilt durch Rezeptportionen umrechnen. Bei Faktor 1 MUST der eingegebene Text unverändert erscheinen. Umgerechnete Mengen MUST lesbar gerundet werden: g und ml auf ganze Zahlen, ab 100 auf Fünfer, ab 1000 g bzw. 1000 ml in kg bzw. l mit einer Nachkommastelle. TL, EL, Tasse und Prise MUST auf Viertel gerundet und als Bruch (¼, ½, ¾) angezeigt werden. Alle übrigen Mengen MUST auf Halbe gerundet werden, mindestens aber ½ betragen. Bei Spannen MUST beide Grenzen umgerechnet werden. Zutaten ohne Menge MUST unverändert bleiben.

#### Scenario: Verdoppeln
- **WHEN** der Nutzer bei einem Rezept für 4 Portionen mit „600 g Hähnchenbrust“ und „1 EL Currypulver“ 8 Portionen wählt
- **THEN** zeigt das System „1,2 kg Hähnchenbrust“ und „2 EL Currypulver“

#### Scenario: Halbieren
- **WHEN** der Nutzer bei „1 TL Salz“ und „3 Eier“ (4 Portionen) 2 Portionen wählt
- **THEN** zeigt das System „½ TL Salz“ und „1½ Eier“

#### Scenario: Hundert und mehr Gramm
- **WHEN** der Nutzer bei „250 g Steinofenbaguette“ (2 Portionen) 3 Portionen wählt
- **THEN** zeigt das System „375 g Steinofenbaguette“

#### Scenario: Spanne
- **WHEN** der Nutzer bei „1-2 Knoblauchzehen“ die Portionen verdoppelt
- **THEN** zeigt das System „2–4 Knoblauchzehen“

#### Scenario: Ohne Menge
- **WHEN** das Rezept „Salz und Pfeffer“ enthält und umgerechnet wird
- **THEN** bleibt „Salz und Pfeffer“ unverändert

### Requirement: Mengen-Varianten in der Zubereitung
Das System SHALL in Zubereitungsschritten eine Menge mit nachfolgender eckiger Klammer, die durch „|“ getrennte Mengen enthält („200 ml [300 ml | 400 ml]“, „6 [9 | 12]“), als Mengen für die Rezeptportionen und für jeweils eine Portion mehr lesen. Angezeigt MUST nur eine Menge werden: die Variante für die gewählten Portionen, wenn es sie gibt; ohne Auswahl oder bei den Rezeptportionen die Grundmenge; sonst die nach den Regeln für Zutaten umgerechnete Grundmenge, erkennbar als umgerechnet gekennzeichnet. Der gespeicherte Text MUST unverändert bleiben. Text ohne diese Schreibweise MUST unverändert angezeigt werden.

#### Scenario: Ohne Auswahl
- **WHEN** der Nutzer ein HelloFresh-Rezept für 2 Portionen mit dem Schritt „200 ml [300 ml | 400 ml] Milch“ öffnet
- **THEN** zeigt der Schritt „200 ml Milch“

#### Scenario: Passende Variante
- **WHEN** der Nutzer bei diesem Rezept 3 Portionen wählt
- **THEN** zeigt der Schritt „300 ml Milch“, und „ca. 6 [9 | 12] flache Knödel“ erscheint als „ca. 9 flache Knödel“

#### Scenario: Keine Variante
- **WHEN** der Nutzer bei diesem Rezept 6 Portionen wählt
- **THEN** zeigt der Schritt „600 ml Milch“ als umgerechnet gekennzeichnet

#### Scenario: Zeitangabe
- **WHEN** ein Schritt „4 – 5 Min. anbraten“ enthält
- **THEN** bleibt der Text unverändert
