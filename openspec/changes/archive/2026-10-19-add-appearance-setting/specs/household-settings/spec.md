## ADDED Requirements

### Requirement: Darstellung pro Gerät
Das Frontend SHALL auf der Seite „Einstellungen“ einen Bereich „Darstellung“ mit den Optionen „Wie das Gerät“, „Hell“ und „Dunkel“ anbieten. „Wie das Gerät“ MUST voreingestellt sein und dem Farbschema des Betriebssystems folgen. Eine Änderung MUST sofort wirken, ohne Neuladen. Die Wahl MUST nur auf dem aktuellen Gerät im Browser gespeichert werden und MUST NOT über `/api/settings` für den Haushalt gelten. Beim Laden der App MUST die gespeicherte Wahl angewendet werden, bevor die Seite gezeichnet wird. Die Druckansicht MUST unabhängig von der Wahl hell bleiben.

#### Scenario: Hell erzwingen
- **WHEN** das Gerät auf dunkles Farbschema eingestellt ist und ein Nutzer unter „Darstellung“ „Hell“ wählt
- **THEN** zeigt die App sofort das helle Farbschema und auch nach dem Neuladen

#### Scenario: Zurück zur Systemeinstellung
- **WHEN** ein Nutzer „Wie das Gerät“ wählt
- **THEN** folgt die App wieder dem Farbschema des Betriebssystems

#### Scenario: Nur dieses Gerät
- **WHEN** Felix auf seinem Handy „Dunkel“ wählt
- **THEN** bleibt die Darstellung auf Linhs Handy unverändert
