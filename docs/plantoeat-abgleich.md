# Abgleich: Plan to Eat ↔ Essenplaner

Stand: 2026-10-14. Quelle sind die öffentlichen Tour-Seiten von plantoeat.com
(Recipe Organizer, Meal Planner, Shopping List, Macro Tracking). Code und
Oberfläche von Plan to Eat wurden nicht untersucht.

Legende: ✅ vorhanden · 🗓️ als Change geplant · ❌ fehlt

## Rezeptbuch

| Plan to Eat | Essenplaner | Anmerkung |
|---|---|---|
| Rezepte an einem Ort speichern | ✅ `recipe-catalog` | |
| Suche nach Titel/Stichwort | ✅ `recipe-catalog` | |
| Rezepte per Link/Clipper importieren | 🗓️ `add-recipe-url-import` | JSON-LD, liefert strukturierte Zutaten |
| Rezepte aus Dateien anderer Apps importieren | – | Bewusst weggelassen: HelloFresh-Rezepte lassen sich direkt per URL importieren |
| Rezepte von Hand anlegen und bearbeiten | ❌ | Grundlage für alles Weitere |
| Kategorien: Gang, Küche, Hauptzutat, Tags | ❌ | |
| Bewertung | ❌ | |
| Filtern nach Kategorie, Suche nach Zutat | ❌ | |
| Portionen skalieren | ✅ `servings-scaling` | Detailansicht, auch HelloFresh-Mengen in eckigen Klammern |
| Kochansicht (Bildschirm bleibt an, Schritt für Schritt) | ❌ | Wake Lock API |
| Benannte Timer | ❌ | |
| Notizen zur Vorbereitung | ❌ | |
| „Warteschlange“ (Rezepte zum Ausprobieren) | ❌ | |
| Umrechnung ins metrische System | – | für deutsche Rezepte unnötig |
| Ersatzvorschläge für Zutaten | ❌ | niedrige Priorität |
| Teilen mit Freunden | – | eine Familie, ein gemeinsamer Bestand |

## Planer

| Plan to Eat | Essenplaner | Anmerkung |
|---|---|---|
| Kalender mit Rezepten pro Tag | ✅ `meal-plan` | nur **ein Abendessen pro Tag** |
| Mehrere Mahlzeiten pro Tag (Frühstück, Mittag …) | ❌ | Datenmodell-Änderung |
| Notizen und Einzelzutaten im Plan | ❌ | z. B. „Oma kommt“, „Baguette dazu“ |
| Rezepte verschieben, Portionen im Plan ändern | ❌ | |
| Reste einplanen | ❌ | |
| Ganze Wochen tauschen/kopieren | ❌ | |
| Menüs: Pläne speichern und wiederverwenden | ❌ | |
| Gefrierfach (vorgekochte Gerichte, Menge, Datum) | 🗓️ optional `add-freezer` | |
| Plan drucken | ❌ | Print-CSS genügt |
| Suche in der Plan-Historie | ❌ | |
| Gemeinsamer Plan auf allen Geräten | ✅ | |

## Einkaufsliste

| Plan to Eat | Essenplaner | Anmerkung |
|---|---|---|
| Automatisch aus dem Plan erzeugt | ✅ | „Aus dem Plan übernehmen“, auf Portionen umgerechnet |
| Gleiche Zutaten zusammenfassen | ✅ | g/kg und ml/l umgerechnet, gelerntes Zusammenführen |
| Eigene Artikel ergänzen | ✅ | |
| Nach Geschäft und Gang sortieren, Zuordnung merken | ✅ | Kategorien mit Vorschlägen, Geschäftsfilter |
| Abhaken beim Einkaufen, Bildschirm bleibt an | ✅ | Abgleich alle 10 s, Wake Lock |
| „Habe ich schon“ ausblenden | ❌ | |
| Vorratsliste (Staples) gesammelt hinzufügen | ✅ | „Vorrat prüfen“ |
| Liste per Nachricht teilen | ✅ | Web Share API, sonst Zwischenablage; Druckansicht |
| Lieferdienst-Anbindung | – | US-spezifisch, weglassen |

## Nährwerte

| Plan to Eat | Essenplaner | Anmerkung |
|---|---|---|
| Nährwerte pro Rezept automatisch | 🗓️ optional `add-nutrition` | braucht Lebensmitteldatenbank, aufwendig |
| Tagessummen im Planer | 🗓️ optional `add-nutrition` | |

## Kernbefund

Fast alles, was Plan to Eat ausmacht (Einkaufsliste, Skalieren, Suche nach
Zutat, Nährwerte), hängt an **strukturierten Zutaten** (Menge, Einheit, Name).
Der URL-Import liefert strukturierte Zutaten direkt von der Rezeptseite.
Ein zusätzlicher Umweg über exportierte PDF-Dateien ist deshalb nicht vorgesehen.

## Geplante Changes

Alle Lücken sind als OpenSpec-Changes geplant. Zuerst kommen die
Plan-to-Eat-Funktionen, beginnend mit dem URL-Import (Gegenstück zum Recipe
Clipper). Der nächste Kernpfad führt über VPS-Deployment und danach Auth0-Login:

0. `add-recipe-url-import`: Rezepte per Link importieren

1. `add-recipe-editor`: Rezepte anlegen und bearbeiten, strukturierte Zutaten,
   Portionen als Zahl
2. `add-planner-flexibility`: Mahlzeiten, mehrere Einträge, Notizen,
   Einzelzutaten, Portionen pro Eintrag, Reste, Verschieben, Woche kopieren,
   Verlauf, Drucken, Einstellungsseite
3. `add-servings-scaling`: Portionen in der Detailansicht umrechnen,
   Mengen-Varianten in HelloFresh-Schritten, Links aus dem Plan
4. `add-shopping-list`: Einkaufsliste aus dem Plan, Zusammenfassen,
   Kategorien, Geschäfte, Abhaken, Vorratsliste, Teilen
5. `add-recipe-organization`: Gang, Küche, Tags, Bewertung, Ausprobieren,
   Notizen, Zeit, Filter, Suche nach Zutaten
6. `add-menus`: Pläne als Menü speichern und einplanen
7. `add-cooking-view`: Kochansicht, Timer,
   Ersatz-Vorschläge, Rezept teilen und drucken
8. `add-vps-deployment`: automatisches Deployment auf den vorhandenen VPS, zunächst mit temporärem HTTP Basic Auth
9. `add-auth0-login`: Anmeldung auf dem echten Server prüfen und den temporären Schutz ablösen

Optionale, voneinander unabhängige Erweiterungen danach: `add-freezer` und `add-nutrition`.

Die Planerflexibilität steht vor der Einkaufsliste, weil die Liste Portionen
pro Eintrag, Einzelzutaten und Reste braucht.

Bewusst weggelassen: Lieferdienste, Freunde/Teilen zwischen Accounts,
Umrechnung ins metrische System, Cooking Challenges.
