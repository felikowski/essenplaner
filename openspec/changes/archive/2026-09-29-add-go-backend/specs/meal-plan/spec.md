## ADDED Requirements

### Requirement: Gemeinsamer, dauerhafter Plan
Das System SHALL Zuordnungen im Wochenplan dauerhaft speichern, sodass alle Nutzer denselben Plan sehen. Eine Änderung MUST nach dem Neuladen der Seite und auf anderen Geräten sichtbar sein.

#### Scenario: Anderes Gerät
- **WHEN** ein Nutzer am Handy für Freitag ein Rezept auswählt und ein anderer Nutzer danach die Woche am Laptop öffnet
- **THEN** sieht der zweite Nutzer für Freitag dieses Rezept

#### Scenario: Neuladen
- **WHEN** der Nutzer nach dem Zuordnen die Seite neu lädt
- **THEN** ist die Zuordnung weiterhin vorhanden
