## Purpose

Macht die Rezept-PDFs aus einem Google-Drive-Ordner der Familie automatisch im Essenplaner verfügbar und hält sie mit Drive synchron.

## ADDED Requirements

### Requirement: PDFs aus dem Drive-Ordner werden Rezepte
Das System SHALL alle PDF-Dateien im konfigurierten Drive-Ordner und in allen seinen Unterordnern als Rezepte mit der Quellenart `pdf` bereitstellen. Der Titel MUST dem Dateinamen ohne die Endung `.pdf` entsprechen. Dateien im Papierkorb und Dateien, die keine PDF sind, MUST ignoriert werden.

#### Scenario: Neue PDF
- **WHEN** jemand `Linsensuppe.pdf` in den Drive-Ordner legt und danach eine Synchronisierung läuft
- **THEN** erscheint im Katalog das Rezept „Linsensuppe“ mit der Quellenart PDF

#### Scenario: Unterordner
- **WHEN** eine PDF im Unterordner `Suppen/` liegt
- **THEN** wird sie ebenfalls als Rezept übernommen

#### Scenario: Andere Dateitypen
- **WHEN** im Ordner ein Foto `Pizza.jpg` oder ein Google-Doc liegt
- **THEN** wird daraus kein Rezept

### Requirement: Synchronisierung
Das System SHALL den Drive-Ordner automatisch mindestens alle 30 Minuten sowie auf Anforderung synchronisieren. Umbenannte Dateien MUST denselben Rezepteintrag behalten und nur den Titel ändern. Aus dem Ordner entfernte oder gelöschte Dateien MUST als nicht mehr verfügbar markiert werden und nicht gelöscht, damit bestehende Wochenpläne erhalten bleiben. Taucht eine Datei wieder auf, MUST das Rezept wieder verfügbar werden.

#### Scenario: Umbenennen
- **WHEN** `Curry.pdf` in `Hähnchen-Curry.pdf` umbenannt wird und eine Synchronisierung läuft
- **THEN** heißt das bestehende Rezept „Hähnchen-Curry“, und Wochenpläne, die es verwenden, zeigen den neuen Titel

#### Scenario: Entfernen
- **WHEN** eine PDF aus dem Ordner entfernt wird, die am 30.09. eingeplant ist, und eine Synchronisierung läuft
- **THEN** fehlt das Rezept in Katalog und Auswahl, der 30.09. zeigt aber weiterhin dessen Titel

#### Scenario: Manuell synchronisieren
- **WHEN** ein Nutzer „Jetzt synchronisieren“ wählt
- **THEN** führt das System eine Synchronisierung aus und zeigt danach, wie viele Rezepte hinzugekommen, geändert oder entfernt wurden

#### Scenario: Gleichzeitige Anforderung
- **WHEN** eine Synchronisierung angefordert wird, während bereits eine läuft
- **THEN** startet das System keine zweite, und die Antwort bezieht sich auf die laufende

### Requirement: Sync-Status
Das System SHALL unter `GET /api/sync/drive` den Zeitpunkt der letzten Synchronisierung, ihr Ergebnis (Erfolg oder Fehlermeldung) und die Anzahl der Drive-Rezepte liefern. Das Frontend MUST diese Angaben anzeigen. Schlägt eine Synchronisierung fehl, MUST der bisherige Rezeptbestand unverändert bleiben.

#### Scenario: Drive nicht erreichbar
- **WHEN** Google Drive bei der Synchronisierung einen Fehler liefert, zum Beispiel weil der Ordner nicht mehr freigegeben ist
- **THEN** bleiben alle Rezepte unverändert, und der Sync-Status zeigt den Fehler mit einem Hinweis auf die Ursache

### Requirement: PDF ansehen ohne eigenen Drive-Zugriff
Das System SHALL die PDF eines Drive-Rezepts unter `GET /api/recipes/{id}/pdf` an angemeldete Nutzer ausliefern, und zwar mit `Content-Type: application/pdf` und zur Anzeige im Browser. Nutzer MUST dafür keinen eigenen Zugriff auf den Drive-Ordner benötigen. Der Link „PDF öffnen“ im Rezeptdetail MUST auf diese Adresse zeigen.

#### Scenario: PDF öffnen
- **WHEN** ein angemeldetes Familienmitglied ohne Drive-Freigabe „PDF öffnen“ wählt
- **THEN** zeigt der Browser die PDF an

#### Scenario: Nicht angemeldet
- **WHEN** jemand ohne Sitzung `GET /api/recipes/{id}/pdf` aufruft
- **THEN** antwortet das System mit 401

### Requirement: Vorschaubilder
Das System SHALL für Drive-Rezepte ein Vorschaubild der ersten PDF-Seite als `imageUrl` anbieten, wenn Google Drive eines bereitstellt. Es wird über `GET /api/recipes/{id}/thumbnail` ausgeliefert. Liefert Drive kein Vorschaubild, MUST `imageUrl` fehlen.

#### Scenario: Vorschau vorhanden
- **WHEN** der Nutzer die Rezeptliste öffnet
- **THEN** sehen Drive-Rezepte ein Vorschaubild ihrer PDF, sofern Drive eines erzeugt hat
