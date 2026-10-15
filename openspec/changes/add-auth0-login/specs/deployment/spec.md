## ADDED Requirements

### Requirement: Auth0 löst den temporären Proxy-Schutz ab
Das System SHALL den temporären HTTP-Basic-Auth-Schutz am Reverse Proxy erst entfernen, nachdem der Auth0-Anmeldeablauf auf der Produktionsadresse erfolgreich geprüft wurde. Danach MUST ein nicht angemeldeter Aufruf die Login-Seite der Anwendung erreichen, ohne eine HTTP-Basic-Auth-Abfrage auszulösen. `/healthz` MUST weiterhin ohne Anmeldung erreichbar bleiben. Vor einem Rollback auf eine Version ohne anwendungsseitigen Zugriffsschutz MUST HTTP Basic Auth wieder aktiviert werden.

#### Scenario: Dauerhaften Login freischalten
- **WHEN** Anmeldung, Abmeldung, Freigabeliste und Rücksprungziel auf der Produktionsadresse erfolgreich geprüft wurden und der temporäre Proxy-Schutz entfernt wird
- **THEN** erreicht ein nicht angemeldeter Nutzer die Login-Seite der Anwendung ohne vorgeschaltete HTTP-Basic-Auth-Abfrage

#### Scenario: Rollback vor Auth0
- **WHEN** eine Version ausgeliefert werden soll, die noch keinen Auth0-Schutz enthält
- **THEN** muss zuvor der temporäre HTTP-Basic-Auth-Schutz wieder aktiviert sein
