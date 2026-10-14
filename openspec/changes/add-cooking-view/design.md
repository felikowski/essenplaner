## Context

Nach `add-recipe-editor` haben Zutaten `text`, `quantity`, `unit`, `name` und `note`, und im Frontend gibt es den Parser `lib/ingredient.ts`. Nach `add-planner-flexibility` haben Planeinträge Portionen. `add-shopping-list` bringt einen Wake-Lock-Hook mit. Die App ist eine normale Vite-SPA ohne Service Worker. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Die Kochansicht ist mit nassen Fingern aus 50 cm Abstand bedienbar: große Schrift (mindestens 20 px), Tippflächen ab 56 px.
- Timer sind zuverlässig, solange die App offen ist, und sagen ehrlich, wenn sie es nicht sein können.
- Alles läuft im Frontend, es gibt keine neuen API-Endpunkte.

**Non-Goals:**
- Push-Benachrichtigungen über einen Server (Web Push mit VAPID). Das wäre zuverlässiger bei geschlossener App, braucht aber Schlüsselverwaltung, Abonnements und einen Zeitplaner im Backend. Das kann ein späterer Ausbau sein.
- Ganze Zutatentexte umschreiben („eine Prise“ → „zwei Prisen“)

## Decisions

**Umrechnung im Frontend.** `lib/scale.ts` nimmt Zutat und Faktor und liefert den Anzeigetext. Bei Faktor ≠ 1 wird der Text aus den Teilen neu gebaut: `<Menge> <Einheit> <Name>, <Hinweis>`. Spannen erkennt der Frontend-Parser ohnehin. Er liefert dafür zusätzlich die untere Grenze, sodass „1-2 Knoblauchzehen“ doppelt als „2–4 Knoblauchzehen“ erscheint. Die Rundungsregeln stehen in der Spec, und Tabellentests decken jede Regel ab. Eine eigene Formatierung neben der des Backends (`internal/quantity`, Einkaufsliste) ist vertretbar: Dort wird für den Einkauf aufgerundet, hier für das Kochen auf handliche Brüche gerundet.

**Portionen im URL-Parameter.** `/rezepte/:id?portionen=8` und `/rezepte/:id/kochen?portionen=8`. Der Planeintrag verlinkt mit seinen Portionen. Die Auswahl schreibt den Parameter mit `replace`. So ist kein globaler Zustand nötig, und Teilen und Neuladen funktionieren.

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

**Zeit-Erkennung in Schritten.** Ein regulärer Ausdruck erkennt Zahl (inklusive Brüche und Spannen wie im Zutaten-Parser), optional „bis“, und Einheit (Minute/n, Min., Std., Stunde/n, Sekunde/n, Sek.). Der Schritttext wird in Textstücke und Zeit-Elemente zerlegt. Gerendert werden Zeit-Elemente als Buttons, ohne `dangerouslySetInnerHTML`.

**Schritt-Modus:** Wischgesten über Pointer-Events (horizontal mindestens 60 px, schneller als vertikal), dazu Knöpfe „Zurück“ und „Weiter“ und die Pfeiltasten am Laptop. Die Zutaten des aktuellen Schritts werden nicht automatisch erkannt (Non-Goal). Ein Knopf „Zutaten“ öffnet die Liste als Overlay.

**Ersatz-Tabelle** als statische Datei `lib/substitutions.ts`: Schlüssel ist der Zutatenname in Kleinbuchstaben inklusive Varianten, Wert ist eine Liste von Vorschlägen mit Verhältnis. Etwa 30 bis 40 Einträge, recherchiert aus allgemeinem Küchenwissen und in eigenen Worten formuliert.

**Wake Lock:** Der Hook aus `add-shopping-list` wird nach `lib/useWakeLock.ts` verschoben und von beiden Seiten genutzt.

## Risks / Trade-offs

- [iOS beendet Hintergrund-Tabs, Timer klingeln nicht] → Offen kommuniziert. Die Restzeit stimmt beim Zurückkehren dank Endzeitpunkt. Web Push ist der Weg, falls das im Alltag stört.
- [Benachrichtigungen werden abgelehnt] → Ton und Dialog funktionieren weiter, solange die App offen ist.
- [Gerundete Mengen weichen vom Original ab] → Bei Faktor 1 bleibt der Originaltext stehen. Umgerechnete Werte sind als solche erkennbar, weil oben „für 8 Portionen (Rezept: 4)“ steht.
- [Service Worker kann später mit einem PWA-Cache kollidieren] → Der Worker cacht nichts und heißt `sw.js`. Ein späterer PWA-Change erweitert ihn, statt einen zweiten zu registrieren.

## Migration Plan

Nur Frontend-Änderungen und eine zusätzliche statische Datei. Das Go-Binary liefert `sw.js` mit `Cache-Control: no-cache` aus. Rollback: vorheriges Image deployen. Ein registrierter Service Worker ohne Funktion stört nicht.
