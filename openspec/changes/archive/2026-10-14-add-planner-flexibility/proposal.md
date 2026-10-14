## Why

Der Wochenplan kennt bisher genau ein Rezept pro Tag. Im Alltag reicht das nicht: Es gibt Beilagen, ein Mittagessen am Wochenende, Tage mit „Oma kommt“ oder „Reste von Dienstag“, und manchmal kocht man für sechs statt für vier. Die geplante Einkaufsliste (`add-shopping-list`) braucht außerdem pro Planeintrag die Portionen und muss Reste von frisch Gekochtem unterscheiden können. Siehe `docs/plantoeat-abgleich.md`, Abschnitt Planer.

## What Changes

- Mahlzeiten pro Tag: Frühstück, Mittagessen, Abendessen und Snack. Welche davon im Plan erscheinen, legt der Haushalt in den Einstellungen fest. Voreingestellt ist nur das Abendessen, sodass sich für die Familie zunächst nichts ändert.
- Mehrere Einträge pro Mahlzeit, zum Beispiel Hauptgericht und Beilage
- Drei Arten von Einträgen: Rezept, Notiz („Oma kommt“, „Essen gehen“) und Einzelzutat („Baguette“), die später auf der Einkaufsliste landet
- Portionen pro Rezepteintrag, voreingestellt aus dem Rezept
- Reste einplanen: Ein Rezepteintrag lässt sich als Reste auf einen anderen Tag legen. Reste verweisen auf das Original und zählen nicht als Einkauf.
- Einträge verschieben (Tag und Mahlzeit) und entfernen
- Eine ganze Woche in eine andere kopieren, wahlweise ergänzend oder ersetzend
- Planungsverlauf: Die Rezeptdetails zeigen, wann das Rezept zuletzt und wie oft es insgesamt geplant war.
- Plan drucken: eine Druckansicht der Woche
- Neue Seite „Einstellungen“ für Haushalts-Einstellungen, die spätere Changes erweitern
- **BREAKING** (API): `PUT /api/days/{date}` entfällt zugunsten von Endpunkten für Planeinträge. `GET /api/weeks/{week}` liefert pro Tag eine Liste von Einträgen statt einer Rezept-ID.

Nicht Teil dieser Change: Drag & Drop, frei benennbare Mahlzeiten, Menüs (`add-menus`), Gefrierfach (`add-freezer`).

## Capabilities

### New Capabilities
- `household-settings`: Einstellungen, die für den ganzen Haushalt gelten, zunächst die sichtbaren Mahlzeiten

### Modified Capabilities
- `meal-plan`: Mahlzeiten, mehrere Einträge, Eintragsarten, Portionen, Reste, Verschieben, Woche kopieren, Verlauf, Drucken
- `planner-api`: neues Wochen-Schema, Endpunkte für Einträge und das Kopieren von Wochen; `PUT /api/days/{date}` entfällt

## Impact

- Backend: neue Tabelle `plan_entries` statt `plan_days` (Migration überführt bestehende Tage als Abendessen), neue Tabelle `household_settings`, neue Endpunkte unter `/api/entries`, `/api/weeks/{week}/copy`, `/api/settings` und `/api/recipes/{id}/history`
- Frontend: `WeekPage` und `DayCard` werden umgebaut, neuer Dialog für Einträge, neue Seite `/einstellungen`, Druck-CSS, Verlauf in der Rezeptdetailansicht
- Setzt `add-recipe-editor` voraus, weil Portionen dort zur Zahl werden
- Die Anforderung „Nicht mehr verfügbare Rezepte“ (aus `add-recipe-url-import`) nennt `PUT /api/days/{date}`; ihr Szenario wird beim Archivieren auf den neuen Endpunkt umgestellt.
