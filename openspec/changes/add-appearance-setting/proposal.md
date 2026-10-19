## Why

Die App hat schon ein helles und ein dunkles Farbschema, folgt aber immer der Systemeinstellung des Geräts. Wer das Handy dunkel eingestellt hat, die App aber lieber hell nutzen möchte (oder umgekehrt), kann das bisher nicht ändern.

## What Changes

- Neuer Bereich „Darstellung“ auf der Seite „Einstellungen“ mit drei Optionen: „Wie das Gerät“ (Standard, bisheriges Verhalten), „Hell“ und „Dunkel“.
- Die Wahl wirkt sofort und wird pro Gerät im Browser gespeichert, nicht für den ganzen Haushalt. Jedes Familienmitglied entscheidet selbst.
- Die gespeicherte Wahl wird vor dem ersten Zeichnen der Seite angewendet, damit beim Laden nichts kurz im falschen Schema aufblitzt.
- Drucken bleibt unabhängig von der Wahl hell.

## Capabilities

### New Capabilities
<!-- keine -->

### Modified Capabilities
- `household-settings`: Die Einstellungsseite bekommt eine gerätebezogene Einstellung „Darstellung“. Sie wird nicht über `/api/settings` gespeichert.

## Impact

- Frontend: `index.css` (dunkle Farben auch per `data-theme` erzwingbar, helle Farben gegen das System erzwingbar), neues `lib/theme.ts`, `SettingsPage.tsx`, kleines Skript `public/theme.js`, das in `index.html` vor dem Rendern läuft.
- Backend: keine Änderung. Die Content-Security-Policy (`default-src 'self'`) erlaubt das Skript, weil es von derselben Herkunft kommt; ein Inline-Skript wäre blockiert.
- Keine neuen Abhängigkeiten, keine Migration.
