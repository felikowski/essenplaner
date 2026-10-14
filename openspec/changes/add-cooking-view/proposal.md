## Why

Gekocht wird mit dem Handy auf der Arbeitsplatte. Die Detailansicht ist dafür nicht gemacht: Der Bildschirm geht aus, die Schrift ist klein, Mengen gelten nur für die Portionen des Rezepts, und Timer laufen in einer anderen App. Siehe `docs/plantoeat-abgleich.md`, Abschnitt Rezeptbuch.

## What Changes

- Kochansicht für Rezepte mit Zutaten oder Zubereitung: große Schrift, Bildschirm bleibt an, zwei Modi:
  - Überblick mit Zutaten und allen Schritten
  - Schritt für Schritt mit Wischen oder großen Knöpfen
- Zutaten und Schritte lassen sich beim Kochen abhaken. Das gilt nur auf diesem Gerät und für diese Kochsitzung.
- Portionen umrechnen in Detail- und Kochansicht: Alle Mengen werden umgerechnet und lesbar gerundet („½ TL“, „1,2 kg“). Aus dem Wochenplan geöffnet gelten die Portionen des Eintrags.
- Timer: Zeitangaben in Schritten („10 Minuten köcheln“) lassen sich antippen und starten einen benannten Timer. Dazu kommen frei gestellte Timer. Mehrere Timer laufen gleichzeitig und sind auf jeder Seite in einer Leiste sichtbar. Ist die Zeit um, gibt es Ton, Vibration und eine Benachrichtigung.
- Ersatz-Vorschläge: Für gängige Zutaten (Buttermilch, Crème fraîche, Ei beim Backen, …) zeigt ein Hinweis mögliche Alternativen.
- Rezept teilen (Text mit Zutaten, Schritten und Quellenlink über das Teilen-Menü) und drucken

Nicht Teil dieser Change: Sprachsteuerung, Umrechnung zwischen Einheitensystemen, Timer, die bei geschlossener App zuverlässig klingeln (siehe design.md).

## Capabilities

### New Capabilities
- `cooking-view`: Kochansicht, Portionen umrechnen, Timer, Ersatz-Vorschläge, Rezept teilen und drucken

### Modified Capabilities
<!-- keine: die Detailansicht bekommt nur zusätzliche Bedienelemente, ihre bestehenden Anforderungen gelten unverändert -->

## Impact

- Frontend: neue Route `/rezepte/:id/kochen`, Komponenten für Portionen, Timer-Leiste im Layout, Timer-Speicher im `localStorage`, Wake-Lock-Hook (gemeinsam mit der Einkaufsliste), Mengen-Formatierung, statische Ersatz-Tabelle, Druck-Stylesheet für Rezepte, Service Worker für Benachrichtigungen
- Backend: keine Änderung außer der Auslieferung des Service Workers mit passendem Scope und Cache-Header
- Setzt `add-recipe-editor` (strukturierte Zutaten) und `add-planner-flexibility` (Portionen pro Eintrag) voraus
