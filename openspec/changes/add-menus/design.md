## Context

Nach `add-planner-flexibility` gibt es `plan_entries` mit Mahlzeit, Position, Art, Portionen, Text und Reste-Verweis. Außerdem gibt es eine serverseitige Funktion „Woche kopieren“, die Reste über eine ID-Abbildung umhängt, und Dialoge für Hinzufügen und Verschieben. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Menüs fühlen sich an wie ein Wochenplan ohne Datum. Sie nutzen dieselben Bausteine im Frontend und dieselbe Validierung im Backend.
- Einplanen und „Woche kopieren“ teilen sich die Logik.

**Non-Goals:**
- Verknüpfung zwischen Menü und eingeplanten Einträgen. Nach dem Einplanen sind es normale Einträge, Änderungen am Menü wirken nicht zurück.
- Wochentags-gebundene Menüs („immer ab Montag“). Das Startdatum ist frei.

## Decisions

**Spiegeltabelle statt gemeinsamer Tabelle.** `menu_entries` hat dieselben Spalten wie `plan_entries`, nur `menu_id` und `day` (1–28) statt `date`. `leftover_of` zeigt dabei auf `menu_entries`. Dazu `menus (id, name, name_key UNIQUE, description, days, created_at)`. Eine gemeinsame Tabelle mit Diskriminator würde jede Planabfrage mit einer Bedingung belasten und Fremdschlüssel unscharf machen.

**Gemeinsamer Eintragskern.** Im Store gibt es einen Typ `entryDraft` (Mahlzeit, Position, Art, Rezept, Portionen, Text, Reste-Index) und eine Funktion `insertDrafts(tx, target, drafts)`, die IDs vergibt, Positionen ans Ende setzt und Reste über die Abbildung alt → neu auflöst. „Woche kopieren“ aus `add-planner-flexibility` wird darauf umgestellt. „Menü einplanen“ und „Als Menü speichern“ nutzen sie ebenfalls. Die Validierung je Art (Pflichtfelder, verfügbare Rezepte, Textlänge) ist eine gemeinsame Funktion.

**Tage als Zahl im Menü.** `menus.days` speichert die Länge explizit, damit leere Tage in der Mitte erhalten bleiben. „Tag entfernen“ löscht die Einträge des Tages und verringert in derselben Transaktion `day` aller späteren Einträge um eins sowie `days` um eins.

**Frontend nutzt die Plan-Komponenten.** `DayCard` bekommt eine Variante mit Überschrift „Tag n“ statt Datum. Die Dialoge für Hinzufügen und Verschieben bekommen ein Ziel-Interface (`{kind: 'plan', date}` oder `{kind: 'menu', menuId, day}`). Es werden alle Mahlzeiten gezeigt, die im Menü belegt oder in den Einstellungen sichtbar sind, damit nichts unsichtbar im Menü liegt.

**Einplanen-Dialog:** Startdatum mit Schnellwahl („nächster Montag“, „morgen“) und Datumsfeld, dazu eine Vorschau „12.10. – 18.10.2026“. Nach dem Einplanen springt die App zur Woche des Startdatums und zeigt übersprungene Rezepte als Hinweis.

## Risks / Trade-offs

- [Spiegeltabellen laufen auseinander, wenn spätere Changes `plan_entries` erweitern] → `add-freezer` erweitert Einträge. Die Task-Liste dort enthält die Spiegelung, und ein Test vergleicht die Spalten beider Tabellen.
- [Ein Menü mit Einträgen in ausgeblendeten Mahlzeiten wirkt nach dem Einplanen „leer“] → Hinweis beim Einplanen (Spec) und Link zu den Einstellungen.

## Migration Plan

Nur neue Tabellen. Rollback: vorheriges Image deployen.
