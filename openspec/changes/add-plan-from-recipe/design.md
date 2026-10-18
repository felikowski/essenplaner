## Context

Anforderungen siehe `specs/meal-plan/spec.md`, Motivation siehe proposal.md. Bestehende Bausteine:

- `TargetDialog` wählt Tag (Chips der angezeigten Woche + Datumsfeld) und Mahlzeit, kennt aber kein Blättern zwischen Wochen und keine Portionen; er wird zum Verschieben und für Reste genutzt und auch für Menütage.
- `ServingsPicker` (− / Zahl / + / „Rezept: n“) aus der Detailansicht.
- `PlannerApi.createEntry` (HTTP und Mock) legt einen Rezepteintrag mit optionalen `servings` an und hängt ihn hinten an die Mahlzeit.
- `useSettings().settings.visibleMeals` liefert die sichtbaren Mahlzeiten, Standard ist nur Abendessen.
- Die Rezeptkarte in der Liste ist komplett ein `<Link>`.

## Goals / Non-Goals

**Goals:**
- Ein eigenständiger, testbarer Dialog `PlanRecipeDialog`, der selbst speichert und den Fehlerfall im Dialog anzeigt.
- Bei 375 px Breite ohne horizontales Scrollen bedienbar.

**Non-Goals:**
- Kein Einplanen mehrerer Rezepte auf einmal, keine Menütage als Ziel, keine Reste.
- Keine Anzeige, was am gewählten Tag schon geplant ist (wäre ein zusätzlicher Wochenabruf pro Blättern).
- Keine Änderung an Backend und API.

## Decisions

**Neuer Dialog statt `TargetDialog` erweitern.** `TargetDialog` bedient Verschieben, Reste und Menütage mit festen Ziel-Listen. Blättern zwischen Wochen und Portionen dort einzubauen würde drei Aufrufer betreffen. Der neue Dialog nutzt dieselben Bausteine (`Modal`, `.day-chips`/`.chip`, `ServingsPicker`, `isoWeek`-Helfer) und bleibt damit optisch gleich. Alternative „TargetDialog generalisieren“ verworfen, weil der Gewinn gering und das Risiko für bestehende Abläufe größer ist.

**Zustand im Dialog:** `week` (IsoWeek, Start `currentWeek()`), `date` (IsoDate, Start heute), `meal`, `servings`. Blättern ändert nur die angezeigte Woche; der gewählte Tag bleibt, bis ein Chip getippt wird, damit ein Datum aus dem Datumsfeld nicht beim Blättern verloren geht. Wird im Datumsfeld ein Datum gesetzt, springt die angezeigte Woche zu dessen Woche (`weekOf`), sodass der passende Chip markiert ist. Kopfzeile der Tagesauswahl: `‹  KW 43 · 2026  ›` mit `aria-label` „Vorige Woche“/„Nächste Woche“.

**Mahlzeit nur aus sichtbaren Mahlzeiten.** Eingeplante Einträge in ausgeblendeten Mahlzeiten wären in der Wochenansicht unsichtbar. Vorbelegung: `dinner`, falls sichtbar, sonst `visibleMeals[0]` in `MEALS`-Reihenfolge. Ist genau eine Mahlzeit sichtbar (Standard), entfällt das Auswahlfeld und der Dialog nennt sie nur im Bestätigungs-Hinweis – spart Platz am Handy.

**Portionen:** Der Dialog bekommt `initialServings` (aus `useServingsParam` in der Detailansicht, in der Liste `recipe.servings`). Hat das Rezept keine Portionen, wird kein `ServingsPicker` gezeigt und `servings` nicht gesendet. Sonst wird `servings` immer mitgesendet (auch wenn gleich den Rezeptportionen), wie es auch der bestehende Eintrag nach dem Hinzufügen speichert.

**Ergebnis-Rückmeldung:** Der Dialog ruft `api.createEntry` selbst auf (Button zeigt „Wird eingeplant …“), meldet bei Erfolg `onPlanned({ date, meal })` und schließt; die Seite zeigt den Hinweis „Für Mi 21.10. · Abendessen eingeplant“ mit `<Link to="/woche/<KW>">Zur Woche</Link>` als `role="status"`. Bei Fehler bleibt der Dialog offen mit `role="alert"`. Ein kleiner Helfer `plannedNotice(date, meal)` in `lib/` liefert den Text, damit Liste und Detail denselben Wortlaut nutzen.

**Kalender-Symbol in der Rezeptliste.** Ein `<button>` darf nicht in einem `<a>` liegen. Das `<li>` wird `position: relative`, der Button wird als Geschwister des Links rechts in der Karte positioniert (`.recipe-card__plan`, Icon-Button mit „📅“ bzw. SVG, `aria-label="<Titel> einplanen"`), und die Karte bekommt rechts Innenabstand, damit Text nicht darunter läuft. Die Liste hält ein `planning: Recipe | null` und den Hinweis; der Hinweis erscheint oberhalb der Liste, Suchparameter bleiben unberührt. Die Rezeptliste enthält nur verfügbare Rezepte, daher keine Sonderbehandlung.

**Detailansicht:** Button „Einplanen“ in `.recipe-detail__actions` direkt nach „Kochen“, nur wenn `recipe.available !== false`.

## Risks / Trade-offs

- [Zusätzlicher Button auf jeder Karte macht die Karten am Handy enger] → Icon-Button mit 2.5 rem Trefferfläche, Titel bricht um; Prüfung bei 375 px.
- [Doppeltes Tippen legt zwei Einträge an] → Bestätigen-Button ist während des Speicherns deaktiviert.
- [Kein Blick auf den bestehenden Plan des Tages] → bewusst ausgelassen; der Hinweis verlinkt zur Woche.

## Migration Plan

Reiner Frontend-Change, Auslieferung mit dem normalen Deployment; Rollback durch Zurücksetzen des Commits.
