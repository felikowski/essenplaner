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

## Vorschlag für neue Changes

Nach den bereits geplanten Changes (Auth0 → VPS → Drive → URL-Import):

1. `add-recipe-editor`: Rezepte anlegen und bearbeiten, strukturierte Zutaten
   (Menge, Einheit, Name), Portionen, Zubereitungsschritte; Zutaten auch für
   Drive-Rezepte nachtragen
2. `add-shopping-list`: Einkaufsliste aus einer Woche erzeugen, zusammenfassen,
   eigene Artikel, Kategorien/Gänge, abhaken, Vorratsliste
3. `add-recipe-organization`: Tags, Gang, Bewertung, Filter, Suche nach Zutat,
   Warteschlange
4. `add-planner-flexibility`: mehrere Mahlzeiten pro Tag, Notizen, Verschieben,
   Portionen im Plan, Reste, Woche kopieren
5. `add-menus`: Pläne als Menü speichern und in eine Woche übernehmen
6. `add-cooking-view`: Kochansicht mit Wake Lock, Schrittmodus, Timer,
   Portionen skalieren
7. `add-freezer`: vorgekochte Gerichte mit Menge und Datum
8. optional `add-nutrition`: Nährwerte, sinnvoll erst mit stabilem Zutatenmodell

Bewusst weggelassen: Lieferdienste, Freunde/Teilen zwischen Accounts,
Umrechnung ins metrische System.
