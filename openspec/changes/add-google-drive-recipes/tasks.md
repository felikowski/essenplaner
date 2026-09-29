## 1. Vorbereitung

- [ ] 1.1 `docs/google-cloud-setup.md` anlegen: Google-Cloud-Projekt anlegen, Drive-API aktivieren, Dienstkonto und Schlüssel anlegen, Ordner freigeben, Ordner-ID ermitteln; mit einem Testordner nachvollziehen
- [ ] 1.2 Konfiguration `DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `DRIVE_SYNC_INTERVAL` mit Prüfung beim Start (beide oder keiner); Tests
- [ ] 1.3 Migration: `recipes.available`, `recipes.drive_path`, `drive_files`, `sync_runs`; Migrationstest auf einer Datenbank mit bestehenden Daten

## 2. Drive-Client

- [ ] 2.1 Interface `DriveLister` (rekursiv PDFs listen, Datei streamen, Vorschaubild holen) samt Implementierung mit `google.golang.org/api/drive/v3`; Unit-Tests gegen einen `httptest`-Fake der Drive-API, inklusive Paginierung und Unterordnern
- [ ] 2.2 Wiederholung mit Backoff bei 429/5xx; Test mit Fake, der zweimal 503 liefert

## 3. Synchronisierung

- [ ] 3.1 Abgleichslogik (neu, umbenannt, entfernt, wieder aufgetaucht) in einer Transaktion; Tabellentests für jeden Fall und für „Listing bricht ab → nichts ändert sich“
- [ ] 3.2 Entfernen der Beispielrezepte beim ersten erfolgreichen Sync; Test
- [ ] 3.3 Hintergrund-Ticker und Mutex für nur einen Lauf, Ergebnis in `sync_runs`; Test: zwei gleichzeitige Anforderungen führen zu einem Lauf
- [ ] 3.4 `GET/POST /api/sync/drive`; httptest-Tests für Status, Auslösen und Fehlerstatus

## 4. Auslieferung

- [ ] 4.1 `GET /api/recipes/{id}/pdf` als Streaming-Proxy mit Headern; Tests für 200, 404 bei Nicht-Drive-Rezept und 401 ohne Sitzung
- [ ] 4.2 `GET /api/recipes/{id}/thumbnail` mit Datei-Cache, `imageUrl` in der Rezept-API; Test prüft Cache-Treffer und Invalidierung bei neuer md5
- [ ] 4.3 `available` in der Rezept-API: Liste ohne nicht verfügbare, Einzelabruf mit Flag, 422 beim Zuordnen; Tests

## 5. Frontend

- [ ] 5.1 Hinweis „Nicht mehr verfügbar“ im Plan und im Detail, Ausblenden in Liste und Auswahl; Tests
- [ ] 5.2 Sync-Bereich (letzter Lauf, Ergebnis, „Jetzt synchronisieren“ mit Ladezustand und Zusammenfassung); Tests mit Mock-API
- [ ] 5.3 Ende-zu-Ende manuell prüfen: mit echtem Testordner PDFs hinzufügen, umbenennen, entfernen und synchronisieren; PDF und Vorschaubild mit einem Konto ohne Drive-Freigabe öffnen

## 6. Abschluss

- [ ] 6.1 README und `.env.example` aktualisieren (Dienstkonto, Secret im Container)
