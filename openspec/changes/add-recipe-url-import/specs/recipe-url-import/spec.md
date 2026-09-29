## Purpose

Rezepte von beliebigen Rezeptseiten per Link in den Essenplaner übernehmen, damit sie wie PDF-Rezepte eingeplant werden können, ohne sie abzutippen.

## ADDED Requirements

### Requirement: Rezept per URL importieren
Das System SHALL unter `POST /api/recipes/import` mit dem Body `{"url": "<https-URL>"}` die Seite abrufen und daraus ein Rezept mit der Quellenart `web` anlegen. Grundlage sind strukturierte Rezeptdaten nach schema.org `Recipe` im JSON-LD-Format. Übernommen werden MUST der Titel sowie, soweit vorhanden, Bild, Portionen, Zutaten (als Liste) und Zubereitungsschritte (als Liste). Die Antwort MUST das angelegte Rezept mit Status 201 enthalten. Die Quelle MUST die ursprüngliche Seite verlinken.

#### Scenario: Erfolgreicher Import
- **WHEN** ein Nutzer die URL einer Chefkoch-Rezeptseite importiert
- **THEN** legt das System ein Rezept mit Titel, Bild, Zutaten und Zubereitung dieser Seite an und antwortet mit 201

#### Scenario: Verschachtelte Rezeptdaten
- **WHEN** die Rezeptdaten der Seite in einem `@graph` stehen, `@type` eine Liste ist oder die Zubereitung in `HowToSection`s gegliedert ist
- **THEN** werden die Angaben trotzdem vollständig übernommen, wobei die Schritte aller Abschnitte in Reihenfolge erhalten bleiben

#### Scenario: Keine Rezeptdaten
- **WHEN** die Seite keine schema.org-Rezeptdaten enthält
- **THEN** antwortet das System mit 422 und „Auf dieser Seite wurden keine Rezeptdaten gefunden“, und es wird kein Rezept angelegt

#### Scenario: Ungültige URL
- **WHEN** der Body keine gültige `http`- oder `https`-URL enthält
- **THEN** antwortet das System mit 400

#### Scenario: Seite nicht erreichbar
- **WHEN** die Seite nicht antwortet, einen Fehlerstatus liefert oder kein HTML zurückgibt
- **THEN** antwortet das System mit 502 und einer verständlichen Meldung

### Requirement: Keine Duplikate
Das System SHALL erkennen, wenn eine Seite bereits importiert wurde. Grundlage ist die kanonische Adresse der Seite: die Canonical-Angabe der Seite oder, falls sie fehlt, die Adresse nach Weiterleitungen, ohne Fragment und ohne Tracking-Parameter (`utm_*`). In diesem Fall MUST kein zweites Rezept entstehen. Die Antwort MUST das bestehende Rezept mit Status 200 enthalten. War das Rezept entfernt worden, MUST es wieder verfügbar werden.

#### Scenario: Doppelt importiert
- **WHEN** ein Nutzer eine URL importiert, deren Rezept bereits existiert, auch in einer Variante mit `?utm_source=…`
- **THEN** antwortet das System mit 200 und dem bestehenden Rezept, und im Katalog gibt es das Rezept nur einmal

### Requirement: Importiertes Rezept entfernen
Das System SHALL unter `DELETE /api/recipes/{id}` ein per URL importiertes Rezept als nicht mehr verfügbar markieren. Rezepte aus anderen Quellen, etwa Drive-PDFs, MUST sich so nicht entfernen lassen.

#### Scenario: Entfernen
- **WHEN** ein Nutzer ein importiertes Rezept entfernt, das noch in einem Wochenplan steht
- **THEN** verschwindet es aus Katalog und Auswahl, und der Plan zeigt es mit dem Hinweis „Nicht mehr verfügbar“

#### Scenario: Drive-Rezept
- **WHEN** ein Client `DELETE /api/recipes/{id}` für ein Drive-Rezept aufruft
- **THEN** antwortet das System mit 409, und das Rezept bleibt unverändert

### Requirement: Sicheres Abrufen fremder Seiten
Das System SHALL beim Import ausschließlich Adressen im öffentlichen Internet über Port 80 oder 443 abrufen. Adressen, die auf Loopback-, private, Link-Local- oder andere nicht öffentliche IP-Bereiche auflösen, MUST abgewiesen werden. Das gilt auch nach Weiterleitungen und bei DNS-Namen, die auf solche Adressen zeigen. Ein Abruf MUST nach 10 Sekunden abbrechen, höchstens 5 Weiterleitungen folgen und höchstens 5 MB lesen.

#### Scenario: Interne Adresse
- **WHEN** ein Nutzer `http://127.0.0.1:8080/api/recipes`, `http://169.254.169.254/` oder einen Namen importiert, der auf `10.0.0.5` auflöst
- **THEN** antwortet das System mit 400 und ruft die Adresse nicht ab

#### Scenario: Weiterleitung nach intern
- **WHEN** eine öffentliche Seite auf `http://localhost/` weiterleitet
- **THEN** bricht das System den Abruf ab und antwortet mit 400

#### Scenario: Zu große Seite
- **WHEN** eine Seite mehr als 5 MB liefert
- **THEN** bricht das System den Abruf ab und antwortet mit 502

### Requirement: Import im Frontend
Das System SHALL im Rezeptkatalog „Rezept hinzufügen“ anbieten. Dort wird eine URL eingefügt und importiert. Während des Imports MUST ein Ladezustand angezeigt werden. Nach Erfolg und bei einem Duplikat MUST die Detailansicht des Rezepts geöffnet werden. Fehler MUST als verständliche Meldung im Dialog erscheinen, ohne dass die eingegebene URL verloren geht.

#### Scenario: Import aus dem Katalog
- **WHEN** der Nutzer „Rezept hinzufügen“ wählt, eine URL einfügt und „Importieren“ tippt
- **THEN** sieht er einen Ladezustand und danach die Detailansicht des importierten Rezepts

#### Scenario: Fehler im Dialog
- **WHEN** der Import mit „keine Rezeptdaten gefunden“ scheitert
- **THEN** zeigt der Dialog diese Meldung, und die URL steht weiterhin im Eingabefeld
