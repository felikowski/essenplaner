## Context

`index.css` definiert die hellen Farben als CSS-Variablen auf `:root` und überschreibt sie in `@media (prefers-color-scheme: dark)`. `color-scheme: light dark` sorgt dafür, dass native Steuerelemente mitziehen. Die Druckansicht setzt eigene helle Werte und `color-scheme: light`. Die Content-Security-Policy erlaubt nur Skripte derselben Herkunft, keine Inline-Skripte.

## Goals / Non-Goals

**Goals:**
- Hell, Dunkel oder Systemeinstellung pro Gerät wählbar, ohne Aufblitzen beim Laden.

**Non-Goals:**
- Keine Speicherung auf dem Server oder pro Konto.
- Keine weiteren Farbschemata oder Akzentfarben.

## Decisions

### `data-theme` am `<html>`-Element
Ohne Wahl fehlt das Attribut, und es gilt wie bisher die Media-Query. `data-theme="dark"` setzt die dunklen Variablen unabhängig vom System, `data-theme="light"` schließt die Media-Query per `:root:not([data-theme='light'])` aus. `color-scheme` wird passend auf `light` oder `dark` gesetzt, damit Scrollbalken und Formularelemente stimmen. Die dunklen Werte stehen dafür zweimal im CSS (Media-Query und Attribut).
- *Alternative:* Variablen per JavaScript setzen. Verworfen, weil die Farben dann an zwei Orten in verschiedenen Sprachen gepflegt würden.

### Speichern in `localStorage` unter `essenplaner.theme`
Werte `light` oder `dark`. „Wie das Gerät“ entfernt den Schlüssel. Das passt zu den anderen gerätebezogenen Merkern (`essenplaner.shoppingView`). Ist `localStorage` nicht verfügbar, gilt das Systemschema, und die Wahl wirkt nur bis zum Neuladen.

### Anwenden vor dem Rendern über `public/theme.js`
Ein kleines, klassisches (nicht `type="module"`) Skript im `<head>` liest den Schlüssel und setzt `data-theme`, bevor der Body gezeichnet wird. Ein Inline-Skript verbietet die CSP, und das gebündelte Modul läuft erst nach dem Parsen, was ein kurzes Aufblitzen erzeugen würde. Die Einstellungsseite nutzt `lib/theme.ts` mit derselben Logik zum Umschalten.

## Risks / Trade-offs

- Die dunklen Farbwerte sind doppelt vorhanden → Kommentar im CSS weist darauf hin, beide Stellen gemeinsam zu ändern.
