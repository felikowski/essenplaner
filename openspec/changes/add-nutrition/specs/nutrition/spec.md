## Purpose

Für Rezepte mit Zutaten geschätzte Nährwerte pro Portion berechnen und im Wochenplan als Tagessummen zeigen, nachvollziehbar und mit ehrlicher Angabe, was nicht berechnet werden konnte.

## ADDED Requirements

### Requirement: Nährwerte pro Portion
Das System SHALL für jedes Rezept mit Zutaten und Portionen die Nährwerte pro Portion berechnen: Energie in kcal, Eiweiß, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe und Salz in Gramm. Grundlage MUST die Summe der Nährwerte aller berechenbaren Zutaten geteilt durch die Portionen sein. Die Detailansicht MUST die Werte in einem aufklappbaren Bereich „Nährwerte (geschätzt)“ zeigen, auf ganze kcal und eine Nachkommastelle gerundet. Hat ein Rezept keine Portionen, MUST das System die Werte für das ganze Rezept zeigen und darauf hinweisen. Bei geänderter Portionenauswahl MUST der Wert pro Portion gleich bleiben.

#### Scenario: Berechnet
- **WHEN** ein Rezept für 4 Portionen Zutaten mit zusammen 2400 kcal hat
- **THEN** zeigt die Detailansicht „600 kcal pro Portion“

#### Scenario: Ohne Zutaten
- **WHEN** ein Rezept keine Zutaten hat
- **THEN** zeigt die Detailansicht keinen Nährwertbereich

### Requirement: Zutaten zuordnen
Das System SHALL jede Zutat über ihren Namen einem Lebensmittel aus der eingebetteten Lebensmitteltabelle zuordnen. Ohne gespeicherte Zuordnung MUST das System automatisch den besten Treffer wählen und dabei unverarbeitete Lebensmittel („roh“) vor zubereiteten bevorzugen. Gibt es keinen ausreichend sicheren Treffer, MUST die Zutat als nicht zugeordnet gelten. Der Nutzer MUST für jede Zutat das Lebensmittel über eine Suche ändern oder „nicht berechnen“ wählen können. Diese Wahl MUST für alle Zutaten mit demselben Namen gelten, unter Berücksichtigung gemerkter Zusammenführungen der Einkaufsliste.

#### Scenario: Automatisch
- **WHEN** ein Rezept „2 Zwiebeln“ enthält
- **THEN** ist die Zutat dem Lebensmittel „Zwiebel, roh“ zugeordnet

#### Scenario: Korrigieren
- **WHEN** der Nutzer bei „Sahne“ das Lebensmittel „Schlagsahne 30 % Fett“ wählt
- **THEN** nutzen alle Rezepte mit der Zutat „Sahne“ diese Zuordnung

#### Scenario: Gewürze weglassen
- **WHEN** der Nutzer bei „Salz und Pfeffer“ „nicht berechnen“ wählt
- **THEN** zählt die Zutat nicht als fehlend, sondern als bewusst ausgelassen

### Requirement: Mengen in Gramm umrechnen
Das System SHALL Mengen in Gramm umrechnen: g, kg und mg direkt; ml, cl, dl und l über die Dichte des Lebensmittels, ersatzweise 1 g/ml; TL mit 5 ml, EL mit 15 ml, Tasse mit 240 ml und Prise mit 0,5 g. Für Stück und Mengen ohne Einheit sowie für Zehe, Bund, Dose, Becher, Pck., Scheibe und Kopf MUST ein typisches Gewicht aus einer eingebauten Liste genutzt werden. Der Nutzer MUST ein Gewicht pro Einheit und Zutat festlegen können („1 Stück Zwiebel = 80 g“), das dann für alle Rezepte gilt. Zutaten ohne Menge oder ohne bekanntes Gewicht MUST als nicht berechenbar gelten.

#### Scenario: Stück
- **WHEN** ein Rezept „3 Eier“ enthält und das typische Gewicht eines Eis 60 g beträgt
- **THEN** rechnet das System mit 180 g Ei

#### Scenario: Eigenes Gewicht
- **WHEN** der Nutzer festlegt „1 Dose Tomaten = 400 g“
- **THEN** rechnen alle Rezepte mit „Dose Tomaten“ mit 400 g pro Dose

### Requirement: Abdeckung anzeigen
Das System SHALL zu jedem berechneten Rezept angeben, aus wie vielen seiner Zutaten berechnet wurde, wobei bewusst ausgelassene Zutaten nicht mitzählen. Nicht berechnete Zutaten MUST mit Grund aufgelistet werden („kein Lebensmittel zugeordnet“, „Gewicht unbekannt“, „ohne Menge“) und sich direkt korrigieren lassen. Liegt die Abdeckung unter 100 %, MUST die Anzeige die Werte als unvollständig kennzeichnen.

#### Scenario: Unvollständig
- **WHEN** von 9 Zutaten 7 berechnet wurden und eine bewusst ausgelassen ist
- **THEN** zeigt das System „berechnet aus 7 von 8 Zutaten · unvollständig“ und nennt die fehlende Zutat

### Requirement: Tagessummen im Plan
Das System SHALL die Haushalts-Einstellung `showNutrition` (Standard aus) anbieten. Ist sie eingeschaltet, MUST der Wochenplan je Tag die Summe aus Energie, Eiweiß, Fett und Kohlenhydraten pro Person zeigen, gebildet aus je einer Portion jedes Rezept-, Reste- und Gefrierfach-Eintrags mit Rezept. Notizen und Einzelzutaten MUST nicht zählen. Enthält ein Tag Einträge ohne berechenbare Nährwerte, MUST die Summe als unvollständig gekennzeichnet sein.

#### Scenario: Tagessumme
- **WHEN** am Montag Mittag ein Rezept mit 550 kcal und Abend eines mit 700 kcal pro Portion geplant sind
- **THEN** zeigt der Montag „≈ 1250 kcal“

#### Scenario: Ausgeschaltet
- **WHEN** `showNutrition` aus ist
- **THEN** zeigt der Plan keine Nährwerte

### Requirement: Quelle und Hinweis
Das System SHALL bei allen Nährwertangaben einen Hinweis zeigen, dass es sich um Schätzwerte auf Basis typischer Lebensmittelwerte handelt, die keine Ernährungsberatung ersetzen. Die Datenquelle MUST so genannt werden, wie es ihre Nutzungsbedingungen verlangen.

#### Scenario: Quellenangabe
- **WHEN** der Nutzer den Nährwertbereich aufklappt
- **THEN** sieht er den Hinweis auf Schätzwerte und die Quellenangabe der Lebensmitteldaten

### Requirement: Nährwert-API
Das System SHALL unter `GET /api/recipes/{id}/nutrition` die Werte pro Portion, die Abdeckung und die Zutaten mit Zuordnung, Gramm und Grund liefern, unter `GET /api/weeks/{week}/nutrition` die Tagessummen, unter `GET /api/foods?q=…` höchstens 20 passende Lebensmittel und unter `/api/nutrition/mappings` und `/api/nutrition/piece-weights` die gespeicherten Zuordnungen und Gewichte zum Lesen, Setzen und Löschen. Ungültige Werte (Gewicht nicht zwischen 0,1 und 5000 g, unbekanntes Lebensmittel) MUST mit 422 abgewiesen werden.

#### Scenario: Suche
- **WHEN** ein Client `GET /api/foods?q=sahne` aufruft
- **THEN** antwortet das System mit 200 und höchstens 20 Lebensmitteln, deren Name „Sahne“ enthält

#### Scenario: Rezept ohne Zutaten
- **WHEN** ein Client die Nährwerte eines Rezepts ohne Zutaten abruft
- **THEN** antwortet das System mit 200 und `"coverage": null`
