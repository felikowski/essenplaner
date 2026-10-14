## Context

Die Tabelle `recipes` speichert Zutaten und Schritte als JSON-Listen von Strings (`ingredients_json`, `instructions_json`) und Portionen als Text (`servings`, zum Beispiel „4 Portionen“). `source_kind` ist per CHECK auf `pdf` und `web` begrenzt. Nach `add-recipe-url-import` gibt es zusätzlich `origin` (`seed`, `web-import`), `available` und `canonical_url`. Der URL-Import schreibt Rezepte bisher vollständig. Die Drive-Synchronisierung kommt erst später (`add-google-drive-recipes`).

Migrationen sind nummerierte SQL-Dateien, die `internal/store` beim Start in je einer Transaktion ausführt. Das Frontend greift über das Interface `PlannerApi` zu, mit einer Http- und einer Mock-Implementierung.

Motivation und Umfang: siehe proposal.md. Verhalten: siehe `specs/`.

## Goals / Non-Goals

**Goals:**
- Ein Zutatenmodell, auf dem `add-shopping-list` und das Skalieren ohne weitere Migration aufbauen können
- Ein Formular, das am Handy mit einer Hand bedienbar ist
- Dieselbe Zerlegung im Frontend (Vorschau) und im Backend (gespeicherte Daten)

**Non-Goals:**
- Zutaten zusammenführen oder Einheiten umrechnen (g ↔ kg); das gehört zur Einkaufsliste
- Zwischenüberschriften in Zutatenlisten („Für den Teig“); sie bleiben als Zeile ohne Menge erhalten
- Gleichzeitiges Bearbeiten durch mehrere Personen absichern
- Versionsverlauf von Rezepten

## Decisions

**Zutaten bleiben JSON in der Rezeptzeile.** `ingredients_json` enthält künftig Objekte `{text, quantity?, unit?, name, note?}`. Zutaten werden immer zusammen mit ihrem Rezept gelesen und geschrieben, und die Einkaufsliste fasst nur die wenigen Rezepte einer Woche zusammen. Das geht in Go schneller zu schreiben als mit SQL. Eine eigene Tabelle `recipe_ingredients` wäre normalisierter, kostet aber Joins, Sortierspalten und Löschlogik, ohne dass eine Abfrage sie heute braucht. Sollte später nach Zutaten gesucht werden (`add-recipe-organization`), reicht bei wenigen hundert Rezepten ein Durchlauf im Speicher oder `json_each`.

**`text` ist die Wahrheit, die Zerlegung ist abgeleitet.** Angezeigt wird immer der eingegebene Text. Menge, Einheit und Name dienen nur dem Rechnen. Deshalb nimmt die API beim Schreiben Zutaten als Liste von Zeilen (`string[]`) entgegen und zerlegt sie selbst. Ein verbesserter Parser kann alte Rezepte später neu zerlegen, ohne dass Eingaben verloren gehen. Die Alternative, dass das Frontend fertige Objekte schickt, würde dem Client vertrauen und zwei Wahrheiten erzeugen.

**Ein Parser je Sprache, gemeinsame Testfälle.** Der Parser existiert in Go (`internal/ingredient`) und in TypeScript (`frontend/src/lib/ingredient.ts`). Beide Testsuiten lesen dieselbe Datei `testdata/ingredient-cases.json` im Repository-Wurzelverzeichnis (Zeile → erwartetes Ergebnis). Die Vorschau soll ohne Netz und ohne Verzögerung beim Tippen erscheinen. Ein Vorschau-Endpunkt würde pro Tastendruck eine Anfrage über Mobilfunk kosten. Go nach WebAssembly zu kompilieren wäre für rund 150 Zeilen Logik mehrere MB Bundle. Die gemeinsamen Testfälle halten beide Implementierungen gleich, und das Speichern liefert ohnehin das Ergebnis des Backends zurück.

**Parser-Regeln.** Die Zeile wird an Leerzeichen getrennt, führende Leerzeichen und Aufzählungszeichen (`-`, `•`, `*`) werden entfernt.
1. Menge am Anfang: ganze Zahl, Dezimalzahl (`1,5` oder `1.5`), Bruch `a/b`, Unicode-Brüche (`½ ⅓ ⅔ ¼ ¾ ⅛`), gemischte Zahl (`1 1/2`, `1½`), Spanne mit `-`, `–` oder „bis“ (obere Grenze zählt). Auch „ca.“ davor ist erlaubt.
2. Danach optional eine Einheit aus einer festen Tabelle, die Schreibweisen auf eine Kurzform abbildet: g, kg, mg, ml, cl, dl, l, TL, EL, Msp., Prise, Tasse, Becher, Glas, Dose, Pck., Bund, Stück, Scheibe, Zehe, Zweig, Blatt, Handvoll, Tropfen, Würfel, Kopf, Stange. Ein Beispiel: `Esslöffel`, `EL`, `El.` und `el` werden zu `EL`. Eine Einheit wird nur erkannt, wenn noch ein Name folgt („2 Dosen“ allein ergibt Name „Dosen“ ohne Einheit). An Zahlen angeklebte Einheiten (`200g`) werden getrennt.
3. Der Rest bis zum ersten Komma ist der Name, alles danach der Hinweis. Ohne Menge ist die ganze Zeile der Name, ohne Hinweis-Abtrennung („Salz, Pfeffer“ bleibt ein Name).

Unbekannte Einheiten wie „1 Schuss Sahne“ ergeben Menge 1 und Name „Schuss Sahne“. Das ist für die Einkaufsliste brauchbar, und neue Einheiten lassen sich nachtragen.

**Portionen als ganze Zahl.** Für das Skalieren reicht eine ganze Zahl. Angaben wie „1 Kuchen (26 cm)“ verlieren beim Umwandeln die Form, und Teilportionen sind in Familienrezepten selten. Die Spalte wird `servings INTEGER`.

**Geschützte Felder.** Eine neue Spalte `edited_fields` (JSON-Liste, zum Beispiel `["ingredients"]`) merkt sich, welche Felder von Hand geändert wurden. `PUT` fügt nur die Felder hinzu, deren Wert sich gegenüber dem gespeicherten Stand ändert. Wer nur Zutaten nachträgt, sperrt also nicht die Portionen. Der URL-Import schreibt über eine gemeinsame Store-Funktion, die Felder aus `edited_fields` auslässt. Der spätere Drive-Sync nutzt dieselbe Funktion. Eine Alternative wäre eine separate Tabelle mit Overrides, die beim Lesen darübergelegt werden. Das wäre sauberer im Sinne von „Quelle bleibt unverändert“, verdoppelt aber jede Leseabfrage.

**Titel nur bei eigenen Rezepten.** Bei PDF-Rezepten kommt der Titel künftig aus dem Dateinamen in Drive, und die Familie benennt dort um. Bei Web-Rezepten kommt er von der Seite. Ein zweiter Titel im Essenplaner würde verwirren. `PUT` akzeptiert `title` bei anderen Quellen nur unverändert, sonst gibt es 422. Das Formular zeigt den Titel dort als Text statt als Feld.

**IDs eigener Rezepte.** Zufällige IDs mit Präfix (`m-` + 12 Hex-Zeichen aus `crypto/rand`) statt eines Slugs aus dem Titel. Titel sind änderbar und nicht eindeutig, und eine ID darf sich nicht ändern, weil Wochenpläne darauf zeigen.

**Migration mit Go-Schritt.** SQLite kann einen CHECK nicht ändern. Die Migration baut `recipes` deshalb nach dem üblichen Muster neu auf: neue Tabelle anlegen, Daten kopieren, alte löschen, umbenennen, Indizes neu anlegen, mit `PRAGMA foreign_keys` aus und `foreign_key_check` am Ende. Zerlegen der Zutaten und Umwandeln der Portionen geht in SQL nicht vernünftig. Der Migrations-Runner bekommt deshalb optionale Go-Schritte, die für eine Versionsnummer nach dem SQL in derselben Transaktion laufen. Die Alternative, beim Lesen lazy umzuwandeln, würde zwei Formate dauerhaft im Code halten.

**API-Form.** `POST /api/recipes` und `PUT /api/recipes/{id}` nehmen `{title, servings?, ingredients?: string[], instructions?: string[]}`. `PUT` ersetzt alle drei optionalen Felder, ein fehlendes Feld bedeutet also „leer“. Das Formular schickt immer den vollen Stand. Teil-Updates per PATCH bräuchte heute kein Client. Validierungsfehler kommen als 422 mit `{"error": "...", "field": "servings"}`, damit das Formular die Meldung am richtigen Feld zeigen kann. Das ist eine Erweiterung der einheitlichen Fehlerform um ein optionales Feld.

**Formular.** Eine eigene Seite statt eines Dialogs (`/rezepte/neu`, `/rezepte/:id/bearbeiten`), weil die Tastatur am Handy einen Dialog verdeckt. Zutaten sind eine Liste einzelner Eingabefelder mit Vorschau darunter. Enter springt in eine neue Zeile, Löschen einer leeren Zeile springt zurück. Mehrzeiliges Einfügen verteilt sich auf mehrere Zeilen, damit man eine Zutatenliste aus einer Nachricht übernehmen kann. Zubereitung ist ein Textfeld, jeder Absatz (Zeilenumbruch) ist ein Schritt. Eine Textarea für alle Zutaten wäre einfacher, kann aber keine Vorschau pro Zeile zeigen.

## Risks / Trade-offs

- [Zerlegung liegt bei ungewöhnlichen Zeilen daneben] → Der Text bleibt immer erhalten, und die Vorschau macht Fehler vor dem Speichern sichtbar. Fehlende Einheiten lassen sich mit einem neuen Testfall in der Tabelle nachtragen.
- [Go- und TS-Parser laufen auseinander] → Gemeinsame Testfall-Datei, die beide CI-Testläufe prüfen. Gespeichert wird immer das Ergebnis des Backends.
- [Breaking Change am API-Schema] → Frontend und Backend werden als ein Binary ausgeliefert. Es gibt keine fremden Clients.
- [Tabellenumbau scheitert mittendrin] → Läuft in einer Transaktion. Vor dem Deploy wird die Datenbank auf dem VPS gesichert (Schritt im Migration Plan).
- [Zwei Personen bearbeiten dasselbe Rezept] → Der zuletzt Speichernde gewinnt. Bei einer Familie ist das selten und wird bewusst in Kauf genommen.
- [Geschützte Felder machen Quellen-Updates unsichtbar] → Nur Felder, die tatsächlich von Hand geändert wurden, sind geschützt. Ein „Auf Quelle zurücksetzen“ ist ein möglicher späterer Ausbau.

## Migration Plan

1. Datenbank auf dem VPS sichern (`sqlite3 … ".backup"` im Volume)
2. Deployen. Beim Start laufen Tabellenumbau und Datenumwandlung in einer Transaktion.
3. Stichprobe: Ein Web-Rezept zeigt Zutaten wie vorher, `GET /api/recipes` liefert Zutaten als Objekte und Portionen als Zahl.

Rollback: Das vorherige Binary kann das neue Format nicht lesen. Deshalb wird die gesicherte Datenbank zurückgespielt und dann das vorherige Image deployt. Rezepte, die nach dem Deploy angelegt wurden, gehen dabei verloren.
