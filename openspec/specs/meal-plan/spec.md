# meal-plan Specification

## Purpose

Die Familie legt pro Kalenderwoche fest, welches Rezept es an welchem Tag zum Abendessen gibt, und sieht den Plan auf einen Blick.

## Requirements

### Requirement: Wochenansicht pro Kalenderwoche
Das System SHALL einen Wochenplan für genau eine Kalenderwoche nach ISO 8601 anzeigen, von Montag bis Sonntag. Jeder Tag MUST mit deutschem Wochentagsnamen und Datum angezeigt werden. Beim Öffnen der App MUST die aktuelle Kalenderwoche angezeigt werden.

#### Scenario: App öffnen
- **WHEN** ein Nutzer die App am Mittwoch, 30.09.2026 öffnet
- **THEN** zeigt das System die KW 40/2026 mit den Tagen Montag 28.09. bis Sonntag 04.10.

#### Scenario: Kalenderwoche wird angezeigt
- **WHEN** eine Woche angezeigt wird
- **THEN** sind Kalenderwoche und Jahr sichtbar, zum Beispiel „KW 40 · 2026“

### Requirement: Zwischen Wochen wechseln
Das System SHALL es ermöglichen, zur vorherigen und zur nächsten Kalenderwoche zu wechseln und von jeder Woche aus direkt zur aktuellen Woche zurückzuspringen. Jahreswechsel MUST korrekt nach ISO 8601 behandelt werden.

#### Scenario: Nächste Woche
- **WHEN** der Nutzer in KW 40/2026 „nächste Woche“ wählt
- **THEN** zeigt das System KW 41/2026 mit den dort geplanten Rezepten

#### Scenario: Jahreswechsel
- **WHEN** der Nutzer in KW 53/2026 „nächste Woche“ wählt
- **THEN** zeigt das System KW 1/2027, beginnend am Montag, 04.01.2027

#### Scenario: Zurück zu heute
- **WHEN** der Nutzer eine andere als die aktuelle Woche ansieht und „Heute“ wählt
- **THEN** zeigt das System die aktuelle Kalenderwoche

### Requirement: Rezept einem Tag zuordnen
Das System SHALL es ermöglichen, für einen Tag ein Rezept aus dem Rezeptkatalog auszuwählen, ein bestehendes zu ersetzen oder die Zuordnung zu entfernen. Pro Tag MUST höchstens ein Rezept zugeordnet sein.

#### Scenario: Rezept auswählen
- **WHEN** der Nutzer für einen leeren Tag „Auswählen“ tippt und ein Rezept wählt
- **THEN** zeigt der Tag den Titel dieses Rezepts

#### Scenario: Rezept ersetzen
- **WHEN** der Nutzer für einen belegten Tag ein anderes Rezept wählt
- **THEN** zeigt der Tag nur noch das neu gewählte Rezept

#### Scenario: Zuordnung entfernen
- **WHEN** der Nutzer für einen belegten Tag „Kein Gericht“ wählt
- **THEN** zeigt der Tag „Noch nichts geplant“

#### Scenario: Auswahl abbrechen
- **WHEN** der Nutzer den Auswahldialog ohne Auswahl schließt
- **THEN** bleibt die bisherige Zuordnung unverändert

### Requirement: Geplantes Rezept öffnen
Das System SHALL für jeden belegten Tag einen direkten Weg zur Detailansicht des zugeordneten Rezepts anbieten.

#### Scenario: Vom Plan zum Rezept
- **WHEN** der Nutzer auf das Rezept eines Tages tippt
- **THEN** öffnet das System die Detailansicht dieses Rezepts

### Requirement: Lade- und Fehlerzustände
Das System SHALL anzeigen, dass Daten geladen werden. Wenn das Laden oder Speichern fehlschlägt, MUST eine verständliche Fehlermeldung erscheinen, ohne dass der Rest der Ansicht verschwindet.

#### Scenario: Speichern schlägt fehl
- **WHEN** das Zuordnen eines Rezepts fehlschlägt
- **THEN** zeigt das System eine Fehlermeldung, und der Tag zeigt weiterhin seinen vorherigen Zustand

### Requirement: Gemeinsamer, dauerhafter Plan
Das System SHALL Zuordnungen im Wochenplan dauerhaft speichern, sodass alle Nutzer denselben Plan sehen. Eine Änderung MUST nach dem Neuladen der Seite und auf anderen Geräten sichtbar sein.

#### Scenario: Anderes Gerät
- **WHEN** ein Nutzer am Handy für Freitag ein Rezept auswählt und ein anderer Nutzer danach die Woche am Laptop öffnet
- **THEN** sieht der zweite Nutzer für Freitag dieses Rezept

#### Scenario: Neuladen
- **WHEN** der Nutzer nach dem Zuordnen die Seite neu lädt
- **THEN** ist die Zuordnung weiterhin vorhanden
