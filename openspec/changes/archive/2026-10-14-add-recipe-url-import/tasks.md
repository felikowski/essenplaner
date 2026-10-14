## 1. Abgesichertes Abrufen

- [x] 1.1 `internal/safefetch` mit Dialer-Control, Redirect-Prüfung, Timeout, Größenlimit und Content-Type-Prüfung; Tabellentests für gesperrte Adressen (127.0.0.1, ::1, 10/8, 169.254.169.254, 100.64/10, `[::ffff:127.0.0.1]`, 0.0.0.0) und für Weiterleitung nach intern
- [x] 1.2 Tests mit einem lokalen Testserver für Timeout, mehr als 5 MB, mehr als 5 Weiterleitungen und falschen Content-Type (der Testserver wird dafür explizit per Test-Hook erlaubt)

## 2. Rezeptdaten auslesen

- [x] 2.1 HTML-Fixtures unter `testdata/` sammeln (mindestens Chefkoch, ein WordPress-Rezept-Plugin, Kitchen Stories, eine Seite ohne Rezept, eine mit kaputtem JSON-LD); Dateien liegen vor. Umgesetzt als nachgebaute Seiten mit der typischen Struktur (keine fremden Texte im Repository); echte Seiten in 4.6 geprüft
- [x] 2.2 JSON-LD-Parser mit Normalisierung aller Felder; Tests pro Fixture prüfen Titel, Bild, Portionen, Zutaten und Schritte, dazu Einzelfälle für `@graph`, `@type` als Liste und `HowToSection`
- [x] 2.3 Ermittlung der kanonischen URL und Normalisierung; Tabellentests (utm, Fragment, Host-Großschreibung, fremde Canonical-Domain)

## 3. API

- [x] 3.1 Migration `available` und `canonical_url` mit eindeutigem Teilindex; Migrationstest
- [x] 3.2 `available` in der Rezept-API: Liste ohne nicht verfügbare, Einzelabruf mit Flag, 422 beim Zuordnen per `PUT /api/days/{date}`; Tests
- [x] 3.3 `POST /api/recipes/import`: 201 neu, 200 Duplikat (inklusive Reaktivierung), 400 ungültig/intern, 422 ohne Rezeptdaten, 502 bei Abruffehler; httptest-Tests mit Fake-Fetcher
- [x] 3.4 `DELETE /api/recipes/{id}`: `available = 0` für Web-Importe, 409 für andere Quellen, 404 unbekannt; Tests

## 4. Frontend

- [x] 4.1 `importRecipe` und `deleteRecipe` in `PlannerApi` (Http- und Mock-Implementierung); Tests
- [x] 4.2 Dialog „Rezept hinzufügen“ mit URL-Feld, Ladezustand, Fehlermeldung ohne Verlust der Eingabe und Navigation zum Detail; Tests für Erfolg, Duplikat und Fehler
- [x] 4.3 Hinweis „Nicht mehr verfügbar“ im Plan und im Detail, Ausblenden in Liste und Auswahl; Tests
- [x] 4.4 „Entfernen“ im Detail von Web-Rezepten mit Bestätigung; Bilder mit `referrerpolicy="no-referrer"` und Ausblenden bei Ladefehler; Tests
- [x] 4.5 Ende-zu-Ende manuell prüfen: je ein echtes Rezept von drei verschiedenen Seiten importieren, einplanen, entfernen und erneut importieren

## 5. Abschluss

- [x] 5.1 README um den Rezept-Import ergänzen (unterstützte Seiten, Verhalten ohne Rezeptdaten)
