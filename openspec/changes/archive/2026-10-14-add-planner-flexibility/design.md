## Context

Heute speichert `plan_days (date PRIMARY KEY, recipe_id)` ein Rezept pro Tag, und `PUT /api/days/{date}` setzt es. Das Frontend zeigt pro Tag eine `DayCard` mit einem Auswahldialog (`RecipePicker`). Nach `add-recipe-editor` sind Portionen eine Zahl. Nach `add-recipe-url-import` haben Rezepte `available`. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Ein Eintragsmodell, auf dem Einkaufsliste, Menüs und Gefrierfach ohne weitere Migration aufbauen
- Für die Familie ändert sich zunächst nichts sichtbar, solange nur das Abendessen eingeblendet ist
- Jede Aktion am Handy in höchstens zwei Schritten erreichbar

**Non-Goals:**
- Drag & Drop (am Handy unzuverlässig; Verschieben läuft über einen Dialog)
- Eigene Mahlzeiten-Namen und Uhrzeiten
- Wiederkehrende Einträge („jeden Freitag Pizza“); dafür gibt es später Menüs

## Decisions

**Eine Tabelle für alle Eintragsarten.**
`plan_entries (id TEXT PK, date TEXT, meal TEXT CHECK(...), position INTEGER, kind TEXT CHECK(...), recipe_id TEXT NULL REFERENCES recipes, servings INTEGER NULL, text TEXT NULL, leftover_of TEXT NULL REFERENCES plan_entries ON DELETE SET NULL)` mit einem Index auf `(date, meal, position)`. Zusätzliche CHECKs erzwingen pro Art die Pflichtfelder. Eigene Tabellen je Art würden jede Wochenabfrage zu einem UNION machen. Die Arten unterscheiden sich nur in zwei, drei Feldern.

**Reste als eigene Art mit Verweis.** `kind = 'leftover'`, `recipe_id` wird vom Original übernommen, `leftover_of` zeigt auf das Original. Wird das Original gelöscht, wandelt die Löschfunktion in derselben Transaktion abhängige Reste in Notizen um („Reste: <Titel>“). `ON DELETE SET NULL` allein würde einen Reste-Eintrag ohne Bezug zurücklassen. Die Einkaufsliste ignoriert `leftover`, der Verlauf zählt ihn nicht.

**Position statt Zeitstempel.** `position` ist pro `(date, meal)` fortlaufend. Neue Einträge bekommen `max + 1`, beim Verschieben ans Ende der Zielmahlzeit. Lücken nach dem Löschen sind erlaubt, weil nur die Reihenfolge zählt. Umsortieren innerhalb einer Mahlzeit ist nicht vorgesehen. Die Spalte macht es aber später ohne Migration möglich.

**IDs:** zufällig (`e-` + 12 Hex-Zeichen), wie bei eigenen Rezepten.

**Antwort enthält betroffene Wochen.** Schreibende Endpunkte liefern `{"weeks": [WeekPlan, …]}`. So bleibt das bisherige Muster erhalten, dass das Frontend nach jeder Änderung ohne zweite Anfrage den aktuellen Stand hat. Beim Verschieben über eine Wochengrenze sind es zwei Wochen.

**Woche kopieren serverseitig.** Ein Endpunkt mit Transaktion statt vieler `POST`s vom Client: Das ist atomar, auch bei Funkloch, und kann Reste-Verweise per ID-Abbildung (alt → neu) korrekt umhängen.

**Einstellungen als Key-Value-Tabelle.** `household_settings (key TEXT PK, value_json TEXT)`. Im Go-Code gibt es eine Registry mit Schlüssel, Standardwert und Validierungsfunktion. `PATCH` validiert alle übergebenen Schlüssel, bevor es in einer Transaktion schreibt. Spätere Changes (Einkaufsliste, Nährwerte) tragen nur neue Schlüssel ein. Eine Spalte pro Einstellung bräuchte für jede neue Einstellung eine Migration.

**Frontend:**
- `DayCard` zeigt pro sichtbarer Mahlzeit eine Liste. Jeder Eintrag hat ein Menü (⋯) mit Portionen, Verschieben, Reste einplanen und Entfernen.
- „Hinzufügen“ öffnet einen Dialog mit drei Tabs: Rezept (der bisherige `RecipePicker` mit Suche), Notiz und Zutat.
- Verschieben und Reste nutzen denselben Ziel-Dialog: sieben Tage der aktuellen Woche als Schnellwahl, dazu ein Datumsfeld und eine Mahlzeitenauswahl.
- „Woche kopieren“ steht im Wochen-Menü, mit Wochenauswahl (nächste, übernächste, frei).
- Drucken mit `window.print()` und einem Stylesheet `@media print`, das den Plan als Tabelle setzt.
- Die Einstellungen lädt die App einmal beim Start in einen Context.

**Migration:** `INSERT INTO plan_entries SELECT 'e-' || lower(hex(randomblob(6))), date, 'dinner', 0, 'recipe', recipe_id, (SELECT servings FROM recipes …), NULL, NULL FROM plan_days`, danach `DROP TABLE plan_days`. Reines SQL reicht hier.

## Risks / Trade-offs

- [Breaking API] → Nur das eigene Frontend nutzt sie. Es wird im selben Binary ausgeliefert.
- [Die Wochenansicht wird mit vier Mahlzeiten am Handy lang] → Standardmäßig ist nur das Abendessen sichtbar. Leere Mahlzeiten zeigen nur einen kompakten „+“-Knopf.
- [Gleichzeitige Änderungen] → Der zuletzt Speichernde gewinnt. Weil jede Antwort den aktuellen Wochenstand liefert, sieht jeder nach seiner Aktion die Änderungen der anderen.
- [Das Szenario „Neu zuordnen“ in `recipe-catalog` nennt `PUT /api/days`] → Beim Archivieren dieser Change wird es auf `POST /api/entries` umgeschrieben (Task 6.2).

## Migration Plan

Deploy wie gewohnt. Die Migration läuft beim Start. Vorher wird die Datenbank gesichert, wie seit `add-recipe-editor` üblich. Rollback: Sicherung zurückspielen und das vorherige Image deployen.
