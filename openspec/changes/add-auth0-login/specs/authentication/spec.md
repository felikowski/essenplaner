## Purpose

Stellt sicher, dass nur freigegebene Familienmitglieder den öffentlich erreichbaren Essenplaner nutzen können. Die Anmeldung läuft über Auth0.

## ADDED Requirements

### Requirement: Anmeldung über Auth0
Das System SHALL die Anmeldung ausschließlich über Auth0 anbieten. Welche Anmeldemethoden zur Auswahl stehen, MUST allein die Auth0-Konfiguration bestimmen. Nach erfolgreicher Anmeldung MUST der Nutzer zu der Seite zurückkehren, die er ursprünglich aufrufen wollte. Ziele außerhalb der eigenen Anwendung MUST dabei ignoriert werden.

#### Scenario: Erfolgreiche Anmeldung
- **WHEN** ein nicht angemeldeter Nutzer `/woche/2026-W40` aufruft, „Anmelden“ wählt und sich bei Auth0 mit einer freigegebenen Adresse anmeldet
- **THEN** landet er angemeldet auf `/woche/2026-W40`

#### Scenario: Fremdes Weiterleitungsziel
- **WHEN** der Login mit dem Rücksprungziel `https://evil.example` gestartet wird
- **THEN** leitet das System nach der Anmeldung auf die Startseite der App weiter

#### Scenario: Anmeldung abgebrochen oder abgelehnt
- **WHEN** Auth0 zum Callback mit einem Fehler zurückkehrt, etwa weil der Nutzer abgebrochen hat
- **THEN** zeigt das System die Login-Seite mit einer verständlichen Meldung und legt keine Sitzung an

### Requirement: Freigabeliste
Das System SHALL nur Konten zulassen, deren E-Mail-Adresse in der konfigurierten Freigabeliste steht und von Auth0 als verifiziert gemeldet wird (`email_verified`). Der Vergleich MUST ohne Beachtung von Groß- und Kleinschreibung erfolgen. Die Prüfung MUST in der Anwendung stattfinden, unabhängig von Einstellungen in Auth0. Abgewiesene Nutzer MUST eine verständliche Meldung erhalten, und es MUST keine Sitzung entstehen.

#### Scenario: Nicht freigegeben
- **WHEN** sich jemand mit einer Adresse anmeldet, die nicht auf der Freigabeliste steht
- **THEN** zeigt das System „Dieses Konto hat keinen Zugriff“ und legt keine Sitzung an

#### Scenario: Unverifizierte Adresse
- **WHEN** Auth0 die E-Mail-Adresse als nicht verifiziert meldet
- **THEN** weist das System die Anmeldung mit einem Hinweis ab, die Adresse erst zu bestätigen

### Requirement: Sitzungen
Das System SHALL angemeldete Nutzer über ein Sitzungs-Cookie wiedererkennen. Das Cookie MUST `HttpOnly`, `Secure` (außer bei lokaler Entwicklung über http://localhost) und `SameSite=Lax` sein. Eine Sitzung MUST nach 30 Tagen Inaktivität ablaufen. Wird ein Konto von der Freigabeliste entfernt, MUST seine bestehende Sitzung bei der nächsten Anfrage abgewiesen werden.

#### Scenario: Wiederkehrender Nutzer
- **WHEN** ein angemeldeter Nutzer die App nach einer Woche erneut öffnet
- **THEN** ist er ohne erneute Anmeldung angemeldet

#### Scenario: Konto entfernt
- **WHEN** eine Adresse aus der Freigabeliste entfernt und der Dienst neu gestartet wird
- **THEN** erhält dieser Nutzer bei der nächsten API-Anfrage 401

### Requirement: Abmelden
Das System SHALL eine Abmeldung anbieten, die die Sitzung serverseitig ungültig macht, das Cookie löscht und auch die Sitzung bei Auth0 beendet. Danach MUST der Nutzer auf der Login-Seite der App landen.

#### Scenario: Abmelden
- **WHEN** der Nutzer „Abmelden“ wählt und danach erneut „Anmelden“
- **THEN** ist die alte Sitzung ungültig, und Auth0 fragt erneut nach der Anmeldung, statt den Nutzer automatisch wieder anzumelden

### Requirement: Geschützte API
Das System SHALL alle Endpunkte unter `/api/` außer den Anmelde-Endpunkten nur mit gültiger Sitzung beantworten. Ohne gültige Sitzung MUST die Antwort 401 mit `{"error": "unauthorized"}` lauten. Ändernde Anfragen (PUT, POST, DELETE) MUST abgewiesen werden, wenn sie von einer fremden Origin stammen. `/healthz` MUST ohne Anmeldung erreichbar bleiben.

#### Scenario: Ohne Sitzung
- **WHEN** ein Client ohne Sitzungs-Cookie `GET /api/recipes` aufruft
- **THEN** antwortet das System mit 401

#### Scenario: Fremde Origin
- **WHEN** eine Seite auf einer anderen Domain im Browser eines angemeldeten Nutzers `PUT /api/days/2026-09-30` auslöst
- **THEN** antwortet das System mit 403, und der Plan bleibt unverändert

#### Scenario: Sitzung abgelaufen im Frontend
- **WHEN** das Frontend eine 401-Antwort erhält
- **THEN** leitet es zur Login-Seite weiter und merkt sich die aktuelle Seite als Rücksprungziel

### Requirement: Angemeldeten Nutzer anzeigen
Das System SHALL unter `GET /api/me` Name, E-Mail und Profilbild des angemeldeten Nutzers liefern, soweit Auth0 sie übermittelt. Das Frontend MUST den Namen oder das Profilbild sowie die Möglichkeit zum Abmelden anzeigen.

#### Scenario: Profil
- **WHEN** ein angemeldeter Nutzer die App öffnet
- **THEN** sieht er in der Kopfzeile seinen Namen oder sein Profilbild und „Abmelden“
