# household-settings Specification

## Purpose
Einstellungen, die für alle Mitglieder des Haushalts gleich gelten, an einer Stelle pflegen, zum Beispiel welche Mahlzeiten der Wochenplan zeigt.

## Requirements

### Requirement: Einstellungen lesen und ändern
Das System SHALL unter `GET /api/settings` alle Haushalts-Einstellungen als JSON-Objekt liefern und unter `PATCH /api/settings` einzelne Einstellungen ändern. Nicht gesetzte Einstellungen MUST mit ihrem Standardwert geliefert werden. Unbekannte Schlüssel oder ungültige Werte MUST mit 422 abgewiesen werden, ohne dass andere Einstellungen aus derselben Anfrage gespeichert werden.

#### Scenario: Standardwerte
- **WHEN** ein Client `GET /api/settings` aufruft, ohne dass je etwas gespeichert wurde
- **THEN** enthält die Antwort `"visibleMeals": ["dinner"]`

#### Scenario: Ungültiger Wert
- **WHEN** ein Client `{"visibleMeals": ["brunch"]}` sendet
- **THEN** antwortet das System mit 422, und die Einstellungen bleiben unverändert

### Requirement: Sichtbare Mahlzeiten
Das System SHALL die Einstellung `visibleMeals` anbieten: eine nicht leere Teilmenge von `breakfast`, `lunch`, `dinner` und `snack`. Der Wochenplan MUST nur diese Mahlzeiten anzeigen, immer in der Reihenfolge Frühstück, Mittagessen, Abendessen, Snack. Einträge in ausgeblendeten Mahlzeiten MUST erhalten bleiben und wieder erscheinen, sobald die Mahlzeit eingeblendet wird.

#### Scenario: Mittagessen einblenden
- **WHEN** ein Nutzer in den Einstellungen „Mittagessen“ zusätzlich auswählt
- **THEN** zeigt der Wochenplan für jeden Tag Mittagessen und Abendessen

#### Scenario: Letzte Mahlzeit abwählen
- **WHEN** ein Nutzer versucht, alle Mahlzeiten abzuwählen
- **THEN** verhindert das System das und weist darauf hin, dass mindestens eine Mahlzeit sichtbar bleiben muss

### Requirement: Einstellungsseite
Das Frontend SHALL eine Seite „Einstellungen“ anbieten, die über die Hauptnavigation erreichbar ist. Änderungen MUST sofort gespeichert werden und für alle Nutzer gelten.

#### Scenario: Für alle
- **WHEN** ein Nutzer das Mittagessen einblendet und ein anderer Nutzer danach den Plan öffnet
- **THEN** sieht auch der zweite Nutzer das Mittagessen

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
