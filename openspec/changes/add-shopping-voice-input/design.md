## Context

Die Einkaufsliste (`add-shopping-list`) nimmt Artikel über `POST /api/shopping/items` mit `{"text": "…"}` an. `store.AddShoppingItem` zerlegt den Text mit `ingredient.Parse`, folgt gemerkten Zusammenführungen (`shopping_aliases`), sucht einen offenen Artikel mit demselben Schlüssel (`openItem`) und legt sonst einen neuen an, einsortiert über `preferredPlace` (gemerkte Wahl, sonst `shopping.Suggest`, sonst „Sonstiges“). Die App ist ein Go-Binary mit Standardbibliothek und SQLite. Sie läuft hinter Auth0 (`add-auth0-login`), `auth.SessionFrom` liefert die Sitzung einer Anfrage. Geheimnisse liegen in `/etc/essenplaner/production.env`. Bisher ruft die App keinen externen Dienst mit Schlüssel auf; `add-shopping-list` und `add-nutrition` haben ein LLM ausdrücklich verworfen. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Eine Ansage mit vielen Artikeln landet nach einer Bestätigung vollständig auf der Liste, ohne Tippen pro Artikel.
- Die Regeln der Einkaufsliste (Zerlegen, Kategorien, Zusammenfassen) gelten unverändert; das Sprachmodell zerlegt nur den Text in Zeilen.
- Ohne Schlüssel ist das Feature unsichtbar, und der Betrieb bleibt wie bisher.
- Keine neue Go-Abhängigkeit und keine npm-Abhängigkeit.

**Non-Goals:**
- Kategorien durch das Sprachmodell. Die gemerkte Wahl des Haushalts ist genauer und bleibt die einzige Quelle; die Vorschau zeigt, wohin ein Artikel kommt.
- Spracherkennung im Browser (Web Speech API). Sie fehlt in Firefox, schickt Audio in Chrome ohnehin an einen externen Dienst und erkennt Produktnamen schlechter. Kann später als Alternative ohne Schlüssel ergänzt werden.
- Streaming oder Live-Transkription während der Aufnahme.

## Decisions

**Externer Dienst als begründete Ausnahme.** Frühere Changes haben ein LLM wegen Abhängigkeit, Kosten und Datenabfluss verworfen. Hier gibt es keine gleichwertige Alternative: Ein gesprochener Satz hat keine verlässlichen Satzzeichen, und Zahlwörter, Füllwörter und Aufzählungen („noch“, „und“, „zwei Packungen“) lassen sich mit Regeln schlecht trennen. Der Abfluss wird begrenzt: übertragen werden nur Aufnahme oder Text und als Schreibhilfe die Artikelnamen von Liste und Vorrat, nie Rezepte, Plan oder Nutzerdaten. Das Feature ist ohne Schlüssel aus.

**Zwei Aufrufe an die OpenAI-API, über `net/http`.**
1. Transkription: `POST https://api.openai.com/v1/audio/transcriptions` als `multipart/form-data` (`mime/multipart`), Modell aus `OPENAI_TRANSCRIBE_MODEL` (Standard `gpt-transcribe`; das ursprünglich vorgesehene `gpt-4o-mini-transcribe` hat OpenAI am 26.08.2026 abgekündigt, Abschaltung am 26.02.2027, empfohlener Nachfolger `gpt-transcribe`), `language=de`. Als `prompt` gehen die Artikelnamen von Liste und Vorrat mit, damit Namen wie „Hierbas“ oder „Skyr“ richtig geschrieben werden. Bei Freitext entfällt dieser Schritt.
2. Zerlegung: `POST https://api.openai.com/v1/chat/completions` mit `response_format` `json_schema` und `strict: true`, Modell aus `OPENAI_PARSE_MODEL`. Den Standard legt die Umsetzung fest: ein kleines, günstiges Modell mit Unterstützung für strukturierte Ausgaben, geprüft gegen die dann aktuelle Modellliste. Vorläufig `gpt-6-luna` (Stand 19.10.2026 das kleinste aktuelle Modell, Chat Completions und strukturierte Ausgaben, 0,10 $ / 0,50 $ je 1 Mio. Tokens); `gpt-4.1-nano` wird am 23.10.2026, `gpt-5-nano` am 11.12.2026 abgeschaltet. Die endgültige Wahl folgt aus Task 2.4. Schema: `{"lines": string[]}` mit höchstens 50 Einträgen.

Systemanweisung (gekürzt): „Zerlege eine gesprochene deutsche Einkaufsliste in einzelne Artikel, ein Artikel pro Zeile, im Format ‚Menge Einheit Name‘ wie ‚2 Gurken‘, ‚500 g Hack‘, ‚1 Dose Tomaten‘. Zahlwörter als Ziffern. Lass Füllwörter weg. Erfinde nichts, was nicht gesagt wurde. Ist nichts Einkaufbares dabei, gib eine leere Liste zurück.“ Das Transkript geht als Nutzernachricht mit, klar als Daten gekennzeichnet.

Ein eigenes Paket `internal/voice` kapselt beides hinter einer Schnittstelle (`Transcribe`, `SplitLines`), sodass die HTTP-Tests eine Fake-Implementierung nutzen und nie das Netz brauchen. Ein `http.Client` mit 20 Sekunden Timeout je Aufruf; Ziel ist fest `api.openai.com`, daher ohne `safefetch`.

**Nachprüfung der Modellantwort.** Die Zeilen werden getrimmt, Leerzeilen und Doppelte (nach `shopping.Key` des zerlegten Namens) entfernt, auf 50 begrenzt und auf die bestehende Höchstlänge eines Artikels gekürzt. Eine leere Liste ergibt 422 mit „Ich habe nichts zum Einkaufen herausgehört.“ Eine Antwort, die nicht dem Schema entspricht, ergibt 502.

**Endpunkte:**
- `GET /api/shopping/voice` → `{"available": true|false}`. Das Frontend blendet damit den Knopf aus. Ein eigener Endpunkt statt eines Felds in der Einkaufsliste, damit die `ETag`-Versionierung der Liste unberührt bleibt.
- `POST /api/shopping/voice/parse`: Body ist entweder die Aufnahme roh mit `Content-Type: audio/webm`, `audio/mp4` oder `audio/ogg` (begrenzt mit `http.MaxBytesReader` auf 5 MB) oder JSON `{"text": "…"}` (höchstens 2000 Zeichen). Antwort: `{"transcript": "…", "lines": [{"text": "2 Gurken", "name": "Gurken", "category": "Obst & Gemüse", "mergesInto": null | "Gurken"}]}`. Schreibt nichts in die Datenbank.
- `POST /api/shopping/items/batch` mit `{"texts": ["2 Gurken", …]}` (1 bis 50) → die Liste wie die übrigen Einkaufs-Endpunkte. Mit `?dryRun=1` stattdessen `{"lines": […]}` im Format von `voice/parse`, ohne zu schreiben. Ohne Sprachdienst nutzbar, denn er ist nur „mehrere Eingabefeld-Zeilen auf einmal“.

Alle stehen hinter `Protect` und nutzen `writeError` wie die übrigen Endpunkte. Fehlt der Schlüssel, antworten die beiden Voice-Endpunkte mit 503 bzw. `available: false`.

**Vorschau ohne doppelte Regeln.** Die Kategorie und das Zusammenfassen werden für die Vorschau mit denselben Funktionen bestimmt wie beim Speichern: Eine neue Store-Funktion `PreviewShoppingLines` öffnet eine Lese-Transaktion und wendet pro Zeile `ingredient.Parse`, Alias-Auflösung, `openItem` und `preferredPlace` an, ohne zu schreiben. Die Alias-Auflösung aus `addPart` wird dafür in eine eigene Funktion gezogen, die beide nutzen. `voice/parse` ruft `PreviewShoppingLines` für die Zeilen des Modells auf. Ändert der Nutzer in der Vorschau Zeilen, bewertet das Frontend sie über `POST /api/shopping/items/batch?dryRun=1` neu, entprellt 400 ms nach der letzten Eingabe. So gibt es genau eine Vorschau-Logik.

**Speichern.** `AddShoppingItems(ctx, texts)` prüft zuerst alle Zeilen mit `shoppingText` und schreibt dann in einer einzigen `shoppingTx`, Zeile für Zeile über `addPart` mit `PartManual`. Eine ungültige Zeile bricht vor dem Schreiben ab; ein Fehler mittendrin rollt die Transaktion zurück. Die Version der Liste steigt einmal, sodass andere Geräte beim nächsten Abruf alles auf einmal sehen.

**Grenzen.** Ein Zähler je Auth0-Subjekt im Speicher (gleitendes Fenster, 30 Auswertungen pro Stunde), zurückgesetzt bei Neustart; bei einer Familie genügt das. Gezählt wird nur `voice/parse`. Protokolliert werden Dauer, HTTP-Status des Dienstes und Zahl der Zeilen, nie Audio, Transkript oder Zeilen. Zusätzlich wird im OpenAI-Konto ein monatliches Budget-Limit gesetzt (Betrieb, siehe tasks.md).

**Konfiguration.** `config.Config` bekommt einen optionalen Block `Voice{APIKey, TranscribeModel, ParseModel}`. `FromEnv` setzt die Standardmodelle und lässt einen fehlenden Schlüssel zu. `.env.example` und `docs/deployment.md` nennen die Variablen.

**Frontend.**
- `PlannerApi` bekommt `getVoiceAvailability()`, `parseShoppingVoice(audio | text)`, `previewShoppingLines(texts)` und `addShoppingItems(texts)`. `MockPlannerApi` meldet die Spracheingabe als verfügbar und zerlegt Freitext deterministisch an Zeilenumbrüchen, Kommas und „und“, damit Tests und der Mock-Modus ohne Netz laufen.
- Knopf „Einkauf ansagen“ neben dem Eingabefeld, nur wenn verfügbar. Er öffnet einen Dialog (vorhandenes `Modal`) mit den Zuständen bereit, Aufnahme (Timer bis 1:00, Stopp), Auswertung, Vorschau, Speichern und Fehler.
- Aufnahme mit `MediaRecorder`, erster unterstützter Typ aus `audio/webm;codecs=opus`, `audio/mp4` (Safari/iOS), `audio/ogg`. Ohne `MediaRecorder` oder bei verweigertem Mikrofon zeigt der Dialog nur das Freitextfeld mit einem Hinweis.
- Vorschau: je Zeile Textfeld, Kategorie, ggf. „kommt zu … dazu“, Entfernen; darunter „Zeile hinzufügen“. Primärknopf „4 Artikel hinzufügen“.
- Tippflächen und Schriftgrößen wie auf der Einkaufsliste; der pulsierende Aufnahmepunkt steht bei `prefers-reduced-motion` still. Statuswechsel per `aria-live`.

## Risks / Trade-offs

- [Datenabfluss an einen externen Dienst] → Nur Aufnahme oder Text und Artikelnamen; Feature ohne Schlüssel aus; in README und Proposal offen benannt. Laut OpenAI-API-Bedingungen werden API-Daten standardmäßig nicht zum Training genutzt; vor dem Livegang gegen die aktuellen Bedingungen prüfen.
- [Kosten] → Je Ansage geschätzt ein Bruchteil eines Cents; Limit von 30 Ansagen pro Stunde und Nutzer; Budget-Limit im OpenAI-Konto.
- [Falsch verstandene Wörter („Raum“ statt „Rum“)] → Vorschau mit editierbaren Zeilen und Artikelnamen als Schreibhilfe für die Transkription.
- [Prompt-Injection über die Ansage] → Das Modell liefert nur Zeilen in einem festen Schema; jede Zeile durchläuft die normalen Regeln und die Vorschau. Schlimmstenfalls stehen unsinnige Zeilen in der Vorschau.
- [Modellnamen ändern sich] → Modelle über Umgebungsvariablen, ohne neues Image austauschbar.
- [iOS-Safari nimmt nur `audio/mp4` auf] → Typ beim Start der Aufnahme ermitteln und unverändert weiterreichen; die Transkription nimmt alle drei Formate an.

## Migration Plan

Keine Datenbankmigration. Deployment wie bisher; danach `OPENAI_API_KEY` in `/etc/essenplaner/production.env` eintragen und den Container neu starten. Ohne Eintrag bleibt das Feature aus. Rollback: Schlüssel entfernen (Feature aus) oder vorheriges Image deployen.

## Open Questions

- Welches Modell wird Standard für `OPENAI_PARSE_MODEL`? Wird bei der Umsetzung anhand der aktuellen OpenAI-Modellliste und eines kurzen Vergleichs mit zehn typischen Ansagen festgelegt; das ändert keine Anforderung.
- Wie hoch soll das monatliche Budget-Limit im OpenAI-Konto sein? Betriebsentscheidung des Haushalts, ohne Einfluss auf den Code.
