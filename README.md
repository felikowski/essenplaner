# Essenplaner

Web-App, mit der die Familie pro Kalenderwoche plant, was es an jedem Tag zu essen gibt: Rezepte, Notizen, Einzelzutaten und Reste, wahlweise auch für Frühstück, Mittagessen und Snack (Einstellungen ⚙).

> **⚠️ Nicht öffentlich betreiben.** Es gibt noch keinen Login: Wer den Server erreicht, kann den
> Plan lesen und ändern. Bis `add-auth0-login` umgesetzt ist, den Server nur lokal oder in einem
> privaten Netz laufen lassen.

- [`frontend/`](frontend/README.md) – React-Frontend (Vite)
- [`backend/`](backend/) – Go-Server mit SQLite, liefert API und gebautes Frontend aus
- [`openspec/`](openspec/) – Anforderungen und geplante Änderungen (OpenSpec)

## Voraussetzungen

- Go 1.26 oder neuer
- Node.js 22 oder neuer
- optional Docker

## Entwicklung

```bash
make dev
```

Startet das Backend auf http://localhost:8080 und den Vite-Dev-Server auf http://localhost:5173.
Im Browser die Vite-Adresse öffnen; Vite leitet `/api` an das Backend weiter. Die Datenbank liegt
in `backend/data/essenplaner.db` und wird beim ersten Start mit Beispielrezepten gefüllt.

Läuft das Backend auf einem anderen Port, gibt `BACKEND_URL` dem Vite-Proxy die Adresse:

```bash
cd backend && PORT=9000 go run ./cmd/server
```

```bash
cd frontend && BACKEND_URL=http://localhost:9000 npm run dev
```

Tests und Lint für beide Teile:

```bash
make test
```

## Bauen und Betreiben

```bash
make build
```

Erzeugt `backend/bin/essenplaner`: ein einzelnes Binary, das unter `/api/…` die API und unter allen
anderen Pfaden das Frontend ausliefert.

```bash
./backend/bin/essenplaner
```

Alternativ als Container (Datenbank auf einem Volume unter `/data`):

```bash
docker build -t essenplaner .
```

```bash
docker run --rm -p 8080:8080 -v essenplaner-data:/data essenplaner
```

### Konfiguration

| Variable        | Standard                | Bedeutung                                   |
| --------------- | ----------------------- | ------------------------------------------- |
| `PORT`          | `8080`                  | Port des HTTP-Servers                       |
| `DATABASE_PATH` | `./data/essenplaner.db` | SQLite-Datei; das Verzeichnis wird angelegt |

Im Container ist `DATABASE_PATH=/data/essenplaner.db` gesetzt. Ein Backup ist eine Kopie dieser
Datei (bei laufendem Server zusammen mit `-wal` und `-shm`, oder per `sqlite3 … ".backup …"`).

`GET /healthz` liefert 200, wenn der Server läuft und die Datenbank erreichbar ist, sonst 503.

## API

| Methode | Pfad                  | Beschreibung                                                   |
| ------- | --------------------- | -------------------------------------------------------------- |
| GET     | `/api/recipes`        | alle Rezepte, nach Titel sortiert                              |
| GET     | `/api/recipes/{id}`   | ein Rezept, 404 wenn unbekannt                                 |
| POST    | `/api/recipes`        | eigenes Rezept anlegen (siehe unten)                           |
| PUT     | `/api/recipes/{id}`   | Portionen, Zutaten, Zubereitung (und Titel eigener Rezepte)    |
| PATCH   | `/api/recipes/{id}/organization` | Gang, Küche, Tags, Bewertung, Ausprobieren, Notizen und Zeit teilweise ändern |
| GET/PATCH/DELETE | `/api/tags[/{name}]` | Rezept-Tags auflisten, umbenennen, zusammenführen oder löschen |
| GET     | `/api/weeks/{week}`   | Plan einer Woche (`2026-W40`), je Tag eine Liste von Einträgen |
| POST    | `/api/entries`        | Eintrag anlegen: Rezept, Notiz, Einzelzutat oder Reste          |
| PATCH   | `/api/entries/{id}`   | Datum, Mahlzeit, Portionen oder Text ändern                     |
| DELETE  | `/api/entries/{id}`   | Eintrag löschen (Reste davon werden zu Notizen)                 |
| POST    | `/api/weeks/{week}/copy` | Woche kopieren, Body `{"to": "2026-W42", "mode": "append"}`  |
| GET     | `/api/recipes/{id}/history` | Daten, an denen das Rezept geplant war                    |
| GET/PATCH | `/api/settings`     | Haushalts-Einstellungen, z. B. `{"visibleMeals": ["dinner"]}`   |
| POST    | `/api/recipes/import` | Body `{"url": "…"}`: Rezept von einer Webseite importieren      |
| DELETE  | `/api/recipes/{id}`   | importiertes oder eigenes Rezept entfernen (bleibt in Plänen)   |
| GET     | `/api/shopping/list`  | Einkaufsliste mit `ETag`, unverändert 304                        |
| POST    | `/api/shopping/import` | Body `{"from": "2026-10-15", "to": "2026-10-21"}`: Zutaten aus dem Plan |
| …       | `/api/shopping/…`     | Artikel, Kategorien, Geschäfte, Zusammenführungen, Vorrat (siehe `internal/httpapi/shopping.go`) |
| GET/POST | `/api/menus`         | Menüs auflisten oder leer beziehungsweise aus einem Zeitraum anlegen |
| GET/PATCH/DELETE | `/api/menus/{id}` | Menü lesen, Name und Beschreibung ändern oder löschen          |
| POST/PATCH/DELETE | `/api/menus/{id}/entries[/{entry}]` | Menüeinträge anlegen, ändern oder löschen              |
| POST/DELETE | `/api/menus/{id}/days[/{day}]` | Tag anfügen oder entfernen                                 |
| POST    | `/api/menus/{id}/apply` | Menü ab `{"start": "2026-10-12"}` in den Plan übernehmen           |

Fehler haben immer die Form `{"error": "…"}`. Validierungsfehler (422) nennen zusätzlich das
betroffene Feld: `{"error": "…", "field": "servings"}`.

Rezepte anlegen und bearbeiten (`POST`/`PUT`) nehmen
`{"title": "…", "servings": 4, "ingredients": ["200 g Mehl", "…"], "instructions": ["…"]}`.
Zutaten kommen als Zeilen und werden vom Server zerlegt. In Antworten ist jede Zutat ein Objekt
`{"text": "200 g Mehl", "quantity": 200, "unit": "g", "name": "Mehl"}` (`quantity`, `unit` und
`note` fehlen, wenn nichts erkannt wurde), `servings` ist eine Zahl.

## Rezepte anlegen und bearbeiten

„Neues Rezept“ im Katalog legt ein eigenes Rezept an. Über „Bearbeiten“ lassen sich bei allen Rezepten
Portionen, Zutaten und Zubereitung ändern oder nachtragen, auch bei PDF- und Web-Rezepten. Den Titel
ändert man nur bei eigenen Rezepten, bei den übrigen kommt er aus der Quelle.

Zutaten werden Zeile für Zeile eingegeben („200 g Mehl“, „½ TL Salz“, „1-2 Knoblauchzehen“, „Salz und
Pfeffer“). Unter jeder Zeile zeigt das Formular, wie sie in Menge, Einheit und Name zerlegt wird. Das ist
die Grundlage für Einkaufsliste und Portionen. Die Regeln stehen in `backend/internal/ingredient` und
`frontend/src/lib/ingredient.ts`. Beide prüfen dieselben Fälle aus `testdata/ingredient-cases.json`.

Von Hand geänderte Angaben bleiben erhalten, wenn ein Rezept erneut per Link importiert wird.

## Menüs

„Menüs“ im Wochenplan öffnet wiederverwendbare, benannte Pläne mit bis zu 28 Tagen. Eine angezeigte
Woche oder ein anderer Zeitraum lässt sich über „Als Menü speichern“ übernehmen; leere Tage am Ende
entfallen dabei. Im Menü können Name, Beschreibung, Tage und dieselben Eintragsarten wie im Wochenplan
bearbeitet werden. Beim Einplanen wird ein freies Startdatum gewählt, vorhandene Einträge bleiben davor
stehen. Nicht mehr verfügbare Rezepte werden übersprungen und anschließend genannt.

## Rezepte einordnen und finden

Rezepte lassen sich unabhängig von ihrer Quelle nach Gang, Küche, Tags, Bewertung, „Ausprobieren“,
Zubereitungszeit und einer Familiennotiz einordnen. Sterne und die Ausprobieren-Markierung sind direkt
in der Detailansicht änderbar; nach dem ersten geplanten Kochen fragt die Ansicht „Wie war’s?“. Beim
Import per Link werden Gang, Küche, Tags und Gesamtzeit aus den strukturierten Rezeptdaten vorbelegt,
ohne bestehende Angaben zu überschreiben.

Die Rezeptliste durchsucht außer dem Titel auch Tags, Küche und Zutaten. Filter und Sortierung stehen in
der Adresse und bleiben dadurch beim Neuladen oder Teilen erhalten. „Was habe ich da?“ findet Rezepte zu
mehreren vorhandenen Zutaten, berücksichtigt gemerkte Zusammenführungen der Einkaufsliste und zeigt
gefundene sowie fehlende Eingaben. Rezept-Tags werden in den Einstellungen umbenannt, zusammengeführt
und gelöscht.

## Portionen umrechnen

Hat ein Rezept Portionen, lassen sie sich in der Detailansicht mit „−“ und „+“ ändern (1 bis 99). Die
Zutaten werden dann umgerechnet und auf abmessbare Werte gerundet („375 g“, „1,2 kg“, „¾ TL“, „1½ Eier“),
die Auswahl steht in der Adresse (`/rezepte/<id>?portionen=6`). Der Wochenplan öffnet Rezepte und Reste
mit den Portionen des Eintrags. Schritte mit Mengen in eckigen Klammern, wie HelloFresh sie schreibt
(„200 ml [300 ml | 400 ml] Milch“), zeigen nur die Menge für die gewählten Portionen; gibt es keine
passende, wird umgerechnet und die Menge kursiv markiert. Gespeichert wird dabei nichts. Die Regeln stehen
in `frontend/src/lib/scale.ts` und `frontend/src/lib/stepAmounts.ts`.

## Kochen und Timer

Rezepte mit Zutaten oder Zubereitung haben eine Kochansicht mit großer Schrift. Im Überblick lassen sich
Zutaten und Schritte für die aktuelle Sitzung abhaken; „Schritt für Schritt“ zeigt immer nur einen Schritt
und wechselt per Wischen, Pfeiltasten oder großen Knöpfen. Die gewählten Portionen und umgerechneten Mengen
werden aus Detailansicht und Wochenplan übernommen. Zeitangaben wie „10 Minuten“ oder „5–7 Minuten“ starten
direkt einen benannten Timer. Gängige Zutaten zeigen auf Wunsch Ersatzmöglichkeiten. In der Detailansicht
lassen sich Rezepte außerdem teilen oder drucken.

Mehrere freie oder aus Schritten gestartete Timer laufen parallel und erscheinen auf jeder Seite. Sie
werden auf diesem Gerät gespeichert und stimmen nach einem Neuladen weiter. Solange die App geöffnet ist,
meldet ein abgelaufener Timer sich mit Dialog, Ton und – wenn unterstützt – Vibration beziehungsweise
Browser-Benachrichtigung. Mobile Browser können eine geschlossene oder eingefrorene App beenden; dann kann
kein zuverlässiger Alarm erfolgen. Beim nächsten Öffnen zeigt die App, wie lange der Timer bereits
abgelaufen ist.

**Vor einem Update mit Datenbank-Migration sichern.** Manche Versionen bauen beim Start Tabellen um
(zum Beispiel die Umstellung auf zerlegte Zutaten). Die alte Version kann die neue Datenbank danach nicht
mehr lesen, ein Rollback heißt also: Sicherung zurückspielen. Sicherung bei laufendem Server:
`sqlite3 data/essenplaner.db ".backup data/essenplaner-$(date +%F).db"`.

## Einkaufsliste

Unter „Einkauf“ führt der Haushalt eine gemeinsame Liste. „Aus dem Plan“ übernimmt für einen Zeitraum
(voreingestellt heute plus sechs Tage) die Zutaten aller Rezepteinträge, auf die geplanten Portionen
umgerechnet, und alle Einzelzutaten. Reste, Notizen und schon übernommene Einträge werden übersprungen,
Rezepte ohne Zutaten werden mit einem Link zum Nachtragen genannt. Gleiche Zutaten werden zusammengefasst
(„500 g“ + „1 kg“ = „1,5 kg“, „250 g + 2 EL“ bei verschiedenen Einheiten), Stückzahlen aufgerundet.

Jeder Artikel steht in einer Kategorie (Gang im Laden). Vorschläge für rund 400 Zutaten liegen in
`backend/internal/shopping/suggestions.json`; ändert man die Kategorie oder das Geschäft eines Artikels,
merkt sich die Liste das für den Namen. Über ⋯ an einem Artikel lassen sich auch Artikel zusammenführen
(„Zwiebel“ in „Zwiebeln“, ebenfalls gemerkt), in den Vorrat übernehmen oder löschen. Kategorien,
Geschäfte und gemerkte Zusammenführungen verwaltet man in den Einstellungen.

Die Seite fragt alle 10 Sekunden nach Änderungen, solange sie sichtbar ist, und hält den Bildschirm an.
„Vorrat prüfen“ (`/einkauf/vorrat`) bringt angekreuzte Dinge, die immer im Haus sein sollen, auf die Liste.
„Teilen“ nutzt das Teilen-Menü des Handys oder kopiert die Liste, „Drucken“ hat eine eigene Druckansicht.

## Rezepte per Link importieren

„Rezept hinzufügen“ im Rezeptkatalog übernimmt Titel, Bild, Portionen, Zutaten und Zubereitung von
einer Rezeptseite. Grundlage sind die strukturierten Rezeptdaten (schema.org `Recipe` als JSON-LD), die
fast alle großen Rezeptseiten für Suchmaschinen ausliefern, etwa Chefkoch, Lecker, BBC Good Food,
Allrecipes und Kochblogs mit WordPress-Rezept-Plugins. Seiten ohne solche Daten (zum Beispiel
Übersichtsseiten) werden mit „Auf dieser Seite wurden keine Rezeptdaten gefunden.“ abgelehnt.

- Dieselbe Seite wird nicht doppelt importiert, auch nicht mit Tracking-Parametern wie `utm_source`.
- Entfernte Rezepte verschwinden aus Katalog und Auswahl, bleiben in bestehenden Plänen aber mit dem
  Hinweis „Nicht mehr verfügbar“ lesbar. Ein erneuter Import macht sie wieder verfügbar.
- Der Server ruft nur Adressen im öffentlichen Internet über Port 80/443 ab (keine internen
  Netzadressen, auch nicht nach Weiterleitungen), höchstens 10 Sekunden lang und bis 5 MB.
- Bilder werden direkt von der Rezeptseite geladen (ohne Referrer).
