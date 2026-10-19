## 1. Mehrere Artikel und Vorschau (Store und API)

- [x] 1.1 Alias-Auflösung aus `addPart` in eine eigene Funktion ziehen; `PreviewShoppingLines` (nur lesend: Zerlegen, Alias, `openItem`, `preferredPlace`) und `AddShoppingItems` (alle Zeilen prüfen, dann eine `shoppingTx`) in `internal/store/shopping.go`; Store-Tests für gemerkte Kategorie, Zusammenfassen mit offenem Artikel, Alles-oder-nichts bei ungültiger Zeile, höchstens 50 Zeilen und genau eine Versionserhöhung sind grün
- [x] 1.2 `POST /api/shopping/items/batch` mit `?dryRun=1` in `internal/httpapi/shopping.go`; HTTP-Tests für Erfolg, `dryRun` schreibt nichts, 422 bei ungültiger Zeile bzw. mehr als 50 Zeilen und einheitliche Fehlerantworten sind grün

## 2. Sprachdienst (Backend)

- [x] 2.1 `config.Voice` mit `OPENAI_API_KEY`, `OPENAI_TRANSCRIBE_MODEL` und `OPENAI_PARSE_MODEL` samt Standardwerten; ohne Schlüssel startet der Dienst. Config-Tests grün; `.env.example` und `docs/deployment.md` nennen die Variablen
- [x] 2.2 Paket `internal/voice`: Schnittstelle mit `Transcribe` und `SplitLines`, OpenAI-Implementierung über `net/http` (Multipart, JSON-Schema, 20 s Timeout), Nachprüfung der Zeilen (trimmen, Doppelte, 50, Höchstlänge); Tests mit `httptest.Server` als OpenAI-Ersatz für Erfolg, leere Liste, Schema-Verstoß, Timeout und HTTP-Fehler sind grün
- [x] 2.3 `GET /api/shopping/voice` und `POST /api/shopping/voice/parse` (Audio roh bis 5 MB, JSON-Text bis 2000 Zeichen) mit Ratenbegrenzung je Auth0-Subjekt (30 pro Stunde) und Protokoll ohne Inhalte; HTTP-Tests mit Fake-Sprachdienst für 200, 401, 413, 422, 429, 502 und 503 sowie ein Test, der prüft, dass das Protokoll weder Transkript noch Zeilen enthält, sind grün
- [x] 2.4 Mit echtem Schlüssel lokal zehn typische Ansagen (Aufnahmen und Freitexte) auswerten, `OPENAI_PARSE_MODEL`-Standard festlegen und in design.md nachtragen; Ergebnisse als Tabelle in der PR-Beschreibung
  - Umsetzung: statt von Hand automatisch auf dem VPS mit dem Produktionsschlüssel, zehn mit `say` erzeugte Aufnahmen und zwei Freitexte, alle korrekt; dazu zwei echte Aufnahmen am Handy. Standards `gpt-transcribe` und `gpt-6-luna` festgelegt, Tabelle in design.md (Open Questions)

## 3. Frontend

- [x] 3.1 `PlannerApi`, `HttpPlannerApi` und `MockPlannerApi` um Verfügbarkeit, Auswertung, Vorschau und gesammeltes Hinzufügen erweitern (Mock zerlegt deterministisch); Tests in `HttpPlannerApi.test.ts` und `MockPlannerApi.test.ts` sind grün
- [x] 3.2 Knopf „Einkauf ansagen“ (nur wenn verfügbar) und Dialog mit Aufnahme über `MediaRecorder`, Timer und Auto-Stopp bei 60 s, Freitext-Alternative, Hinweis ohne Mikrofon; Tests mit gemocktem `MediaRecorder` in `ShoppingPage.test.tsx` für „Nicht konfiguriert“, „Aufnahme zu lang“, „Freitext“ und „Nichts erkannt“ sind grün
- [x] 3.3 Vorschau mit editierbaren Zeilen, Kategorie, „kommt zu … dazu“, Entfernen, „Zeile hinzufügen“, entprellter Neubewertung und „n Artikel hinzufügen“; Tests für „Kategorie und Zusammenfassen“, „Abbrechen“, „Zeile korrigieren“, „Gesammelt hinzufügen“ und „Sprachdienst gestört“ sind grün
- [x] 3.4 Styles für Dialog, Aufnahmepunkt (still bei `prefers-reduced-motion`) und Vorschau; README-Abschnitt zur Einkaufsliste um die Spracheingabe, ihre Voraussetzungen und die übertragenen Daten ergänzen; Screenshots bei 375 px im Browser-Pane im Mock-Modus

## 4. Abschluss

- [x] 4.1 Am Handy mit echtem Schlüssel (lokal oder auf dem Server) eine Ansage mit vier Artikeln aufnehmen, eine Zeile korrigieren und hinzufügen; auf einem zweiten Gerät erscheinen alle Artikel; Screenshot unter `docs/add-shopping-voice-input-mobile.jpg`
  - Umsetzung: live am Handy eine Aufnahme mit vier Artikeln vollständig und korrekt übernommen; das Korrigieren einer Zeile ist nur durch den Seitentest „übernimmt korrigierte, entfernte und ergänzte Zeilen“ und im Browser-Pane geprüft; kein Screenshot abgelegt
- [x] 4.2 `make test` ist grün

## Workflow follow-up

- Auf dem Server `OPENAI_API_KEY` in `/etc/essenplaner/production.env` eintragen und im OpenAI-Konto ein monatliches Budget-Limit setzen.
- Change nach Review archivieren und prüfen, dass die neuen Anforderungen in `openspec/specs/shopping-list/spec.md` und `openspec/specs/deployment/spec.md` stehen.
