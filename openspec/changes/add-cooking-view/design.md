## Context

Nach `add-servings-scaling` gibt es in der Detailansicht eine Portionenauswahl mit URL-Parameter `?portionen=`, die Umrechnung in `lib/scale.ts` und die Auflösung von Mengen-Varianten in Schritten (`lib/stepAmounts.ts`). Der Wochenplan verlinkt bereits mit den Portionen des Eintrags. `add-shopping-list` hat den gemeinsam nutzbaren Hook `lib/useWakeLock.ts` bereits eingeführt. Die App ist eine normale Vite-SPA ohne Service Worker. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Die Kochansicht ist mit nassen Fingern aus 50 cm Abstand bedienbar: große Schrift (mindestens 20 px), Tippflächen ab 56 px.
- Timer sind zuverlässig, solange die App offen ist, und sagen ehrlich, wenn sie es nicht sein können.
- Alles läuft im Frontend, es gibt keine neuen API-Endpunkte.

**Non-Goals:**
- Push-Benachrichtigungen über einen Server (Web Push mit VAPID). Das wäre zuverlässiger bei geschlossener App, braucht aber Schlüsselverwaltung, Abonnements und einen Zeitplaner im Backend. Das kann ein späterer Ausbau sein.

## Decisions

**Portionen aus `add-servings-scaling`.** `/rezepte/:id/kochen?portionen=8` liest denselben Parameter wie die Detailansicht. „Kochen“ in der Detailansicht übernimmt die gewählten Portionen, und die Kochansicht nutzt dieselbe Auswahl-Komponente sowie `lib/scale.ts` und `lib/stepAmounts.ts`, ohne eigene Umrechnung.

**Timer im `localStorage` mit Endzeitpunkt.**
- Ein Timer ist `{id, name, endsAt | remainingMs, paused, recipeId?}`.
- Gespeichert wird der absolute Endzeitpunkt, nicht die Restzeit. So stimmt die Restzeit nach Neuladen, Tab-Wechsel und gedrosselten Hintergrund-Tabs.
- Ein Context liest den Speicher beim Start, reagiert auf das `storage`-Event (mehrere Tabs) und tickt nur, solange Timer laufen, einmal pro Sekunde.
- Die Timer-Leiste sitzt im `Layout` über dem Inhalt, kompakt und einklappbar.
- Server-Speicherung (Timer auf allen Geräten) ist bewusst nicht vorgesehen. Ein Timer gehört zu dem Gerät, das in der Küche liegt.

**Alarm:**
- Solange die Seite sichtbar ist, gibt es einen Ton über Web Audio (ein erzeugter Signalton, keine Audiodatei) im 2-Sekunden-Takt, dazu `navigator.vibrate` und einen Vollbild-Dialog „Fertig“.
- Damit Web Audio auf iOS spielen darf, wird der `AudioContext` beim Starten des Timers (also bei einer Nutzergeste) erzeugt bzw. fortgesetzt.
- Für den Fall, dass die App im Hintergrund ist, registriert die App einen minimalen Service Worker (`/sw.js`, nur für Benachrichtigungen, ohne Caching). Sie zeigt über `registration.showNotification` eine Benachrichtigung an, sobald ein Timer abläuft und die Seite noch läuft, aber nicht sichtbar ist. Die Berechtigung wird beim ersten Timer-Start einmalig erfragt.
- Ist die Seite eingefroren (iOS, geschlossene App), klingelt nichts. Beim nächsten Öffnen zeigt die App sofort „Abgelaufen vor 3 Minuten“. Dieses Verhalten wird in der Oberfläche beim ersten Timer kurz erklärt.

**Zeit-Erkennung in Schritten.** Ein regulärer Ausdruck erkennt Zahl (inklusive Brüche und Spannen wie im Zutaten-Parser), optional „bis“, und Einheit (Minute/n, Min., Std., Stunde/n, Sekunde/n, Sek.). Der Schritttext wird in Textstücke und Zeit-Elemente zerlegt. Gerendert werden Zeit-Elemente als Buttons, ohne `dangerouslySetInnerHTML`. Die Zeit-Erkennung läuft auf den Textstücken, die `lib/stepAmounts.ts` nach dem Auflösen der Mengen-Varianten übrig lässt.

**Schritt-Modus:** Wischgesten über Pointer-Events (horizontal mindestens 60 px, schneller als vertikal), dazu Knöpfe „Zurück“ und „Weiter“ und die Pfeiltasten am Laptop. Die Zutaten des aktuellen Schritts werden nicht automatisch erkannt (Non-Goal). Ein Knopf „Zutaten“ öffnet die Liste als Overlay.

**Ersatz-Tabelle** als statische Datei `lib/substitutions.ts`: Schlüssel ist der Zutatenname in Kleinbuchstaben inklusive Varianten, Wert ist eine Liste von Vorschlägen mit Verhältnis. Etwa 30 bis 40 Einträge, recherchiert aus allgemeinem Küchenwissen und in eigenen Worten formuliert.

**Wake Lock:** Der vorhandene Hook `lib/useWakeLock.ts` wird von Einkaufsliste und Kochansicht genutzt. Er wird um einen Status ergänzt, damit die Kochansicht fehlende Browser-Unterstützung dezent erklären kann; die Einkaufsliste braucht diesen Status nicht auszuwerten.

**Einbindung in die bestehende App-Hülle.** Der `TimerProvider` umschließt im `Layout` die Timer-Leiste und den Seiteninhalt. Der vorhandene `SettingsProvider` bleibt für alle Seiten wirksam. So sind Timer auf jeder Route sichtbar, ohne einen zusätzlichen Hauptnavigationspunkt in die bei 375 px bereits volle Kopfzeile einzubauen.

## Risks / Trade-offs

- [iOS beendet Hintergrund-Tabs, Timer klingeln nicht] → Offen kommuniziert. Die Restzeit stimmt beim Zurückkehren dank Endzeitpunkt. Web Push ist der Weg, falls das im Alltag stört.
- [Benachrichtigungen werden abgelehnt] → Ton und Dialog funktionieren weiter, solange die App offen ist.
- [Service Worker kann später mit einem PWA-Cache kollidieren] → Der Worker cacht nichts und heißt `sw.js`. Ein späterer PWA-Change erweitert ihn, statt einen zweiten zu registrieren.

## Migration Plan

Nur Frontend-Änderungen und eine zusätzliche statische Datei. Das Go-Binary liefert `sw.js` mit `Cache-Control: no-cache` aus. Rollback: vorheriges Image deployen. Ein registrierter Service Worker ohne Funktion stört nicht.
