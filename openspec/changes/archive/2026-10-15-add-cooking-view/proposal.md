## Why

Gekocht wird mit dem Handy auf der Arbeitsplatte. Die Detailansicht ist dafür nicht gemacht: Der Bildschirm geht aus, die Schrift ist klein, und Timer laufen in einer anderen App. Das Umrechnen der Portionen kommt bereits mit `add-servings-scaling`. Siehe `docs/plantoeat-abgleich.md`, Abschnitt Rezeptbuch.

## What Changes

- Kochansicht für Rezepte mit Zutaten oder Zubereitung: große Schrift, Bildschirm bleibt an, zwei Modi:
  - Überblick mit Zutaten und allen Schritten
  - Schritt für Schritt mit Wischen oder großen Knöpfen
- Zutaten und Schritte lassen sich beim Kochen abhaken. Das gilt nur auf diesem Gerät und für diese Kochsitzung.
- Die Kochansicht übernimmt die Portionenauswahl aus `add-servings-scaling` (URL-Parameter `?portionen=`, `lib/scale.ts`, Mengen-Varianten in Schritten). Aus dem Wochenplan geöffnet gelten die Portionen des Eintrags.
- Timer: Zeitangaben in Schritten („10 Minuten köcheln“) lassen sich antippen und starten einen benannten Timer. Dazu kommen frei gestellte Timer. Mehrere Timer laufen gleichzeitig und sind auf jeder Seite in einer Leiste sichtbar. Ist die Zeit um, gibt es Ton, Vibration und eine Benachrichtigung.
- Ersatz-Vorschläge: Für gängige Zutaten (Buttermilch, Crème fraîche, Ei beim Backen, …) zeigt ein Hinweis mögliche Alternativen.
- Rezept teilen (Text mit Zutaten, Schritten und Quellenlink über das Teilen-Menü) und drucken

Nicht Teil dieser Change: Sprachsteuerung, Umrechnung zwischen Einheitensystemen, Timer, die bei geschlossener App zuverlässig klingeln (siehe design.md).

## Capabilities

### New Capabilities
- `cooking-view`: Kochansicht, Timer, Ersatz-Vorschläge, Rezept teilen und drucken

### Modified Capabilities
<!-- keine: die Detailansicht bekommt nur zusätzliche Bedienelemente, ihre bestehenden Anforderungen gelten unverändert -->

## Impact

- Frontend: neue Route `/rezepte/:id/kochen`, Timer-Leiste im Layout, Timer-Speicher im `localStorage`, vorhandener Wake-Lock-Hook (gemeinsam mit der Einkaufsliste), statische Ersatz-Tabelle, Druck-Stylesheet für Rezepte, Service Worker für Benachrichtigungen
- Backend: keine Änderung außer der Auslieferung des Service Workers mit passendem Scope und Cache-Header
- Setzt `add-servings-scaling` (Portionenauswahl, Umrechnung, Links aus dem Plan) voraus
