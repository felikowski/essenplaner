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
| Rezepte aus Dateien anderer Apps importieren | 🗓️ teilweise `add-google-drive-recipes` | Drive-PDFs haben **keine** strukturierten Zutaten |
| Rezepte von Hand anlegen und bearbeiten | ❌ | Grundlage für alles Weitere |
| Kategorien: Gang, Küche, Hauptzutat, Tags | ❌ | |
| Bewertung | ❌ | |
| Filtern nach Kategorie, Suche nach Zutat | ❌ | |
| Portionen skalieren | ❌ | braucht strukturierte Zutaten (Menge, Einheit) |
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
| Gefrierfach (vorgekochte Gerichte, Menge, Datum) | ❌ | |
| Plan drucken | ❌ | Print-CSS genügt |
| Suche in der Plan-Historie | ❌ | |
| Gemeinsamer Plan auf allen Geräten | ✅ | |

## Einkaufsliste

| Plan to Eat | Essenplaner | Anmerkung |
|---|---|---|
| Automatisch aus dem Plan erzeugt | ❌ | Kernfunktion, braucht strukturierte Zutaten |
| Gleiche Zutaten zusammenfassen | ❌ | Mengen und Einheiten normalisieren |
| Eigene Artikel ergänzen | ❌ | |
| Nach Geschäft und Gang sortieren, Zuordnung merken | ❌ | |
| Abhaken beim Einkaufen, Bildschirm bleibt an | ❌ | |
| „Habe ich schon“ ausblenden | ❌ | |
| Vorratsliste (Staples) gesammelt hinzufügen | ❌ | |
| Liste per Nachricht teilen | ❌ | Web Share API |
| Lieferdienst-Anbindung | – | US-spezifisch, weglassen |

## Nährwerte

| Plan to Eat | Essenplaner | Anmerkung |
|---|---|---|
| Nährwerte pro Rezept automatisch | ❌ | braucht Lebensmitteldatenbank, aufwendig |
| Tagessummen im Planer | ❌ | |

## Kernbefund

Fast alles, was Plan to Eat ausmacht (Einkaufsliste, Skalieren, Suche nach
Zutat, Nährwerte), hängt an **strukturierten Zutaten** (Menge, Einheit, Name).
Der Essenplaner kennt Rezepte bisher nur als Titel, Drive-PDFs liefern gar
keine Zutaten. Der URL-Import liefert sie, für PDFs bräuchte es manuelles
Erfassen oder eine Extraktion.

## Geplante Changes

Alle Lücken sind als OpenSpec-Changes geplant. Zuerst kommen die
Plan-to-Eat-Funktionen, beginnend mit dem URL-Import (Gegenstück zum Recipe
Clipper). Danach folgen Google Drive, Auth0-Login und VPS-Deployment. Bis
dahin läuft die App nur lokal:

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
8. `add-freezer`: Gefrierfach mit Einplanen und automatischem Verbrauch
9. `add-nutrition` (optional): Nährwerte aus dem BLS 4.0, Tagessummen

Danach: `add-google-drive-recipes` → `add-auth0-login` → `add-vps-deployment`.

Die Planerflexibilität steht vor der Einkaufsliste, weil die Liste Portionen
pro Eintrag, Einzelzutaten und Reste braucht.

Bewusst weggelassen: Lieferdienste, Freunde/Teilen zwischen Accounts,
Umrechnung ins metrische System, Cooking Challenges.
