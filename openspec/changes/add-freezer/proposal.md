## Why

Wer doppelt kocht und die Hälfte einfriert, spart an stressigen Tagen viel Zeit. Ohne Übersicht vergisst man aber, was im Gefrierschrank liegt und wie alt es ist. Gerichte aus dem Gefrierfach gehören außerdem nicht auf die Einkaufsliste. Siehe `docs/plantoeat-abgleich.md`, Abschnitt Planer.

## What Changes

- Gefrierfach: eine Liste eingefrorener Gerichte mit Name (oder verknüpftem Rezept), Portionen, Einfrierdatum und Notiz, ältestes zuerst, mit Alter und Warnung ab einer einstellbaren Lagerdauer (Standard 3 Monate)
- Gerichte hinzufügen: frei oder direkt aus einem Planeintrag („Einfrieren“, zum Beispiel 4 von 8 Portionen)
- Portionen entnehmen. Ein Gericht ohne verbleibende Portionen verschwindet aus der Liste.
- Aus dem Gefrierfach einplanen: Das Gericht erscheint im Plan mit Schneeflocke und gewählter Portionenzahl. Die Portionen sind damit reserviert und kommen nicht auf die Einkaufsliste. Wird der Eintrag entfernt, ist die Reservierung wieder frei.
- Hinweis im Plan, wenn für ein Rezept noch Portionen im Gefrierfach liegen

Nicht Teil dieser Change: mehrere Gefriergeräte oder Fächer, Erinnerungen per Benachrichtigung, Vorräte außer fertigen Gerichten.

## Capabilities

### New Capabilities
- `freezer`: Gefrierfach verwalten, Einfrieren aus dem Plan, Entnehmen, Einplanen aus dem Gefrierfach, Lagerdauer

### Modified Capabilities
<!-- keine: die neue Eintragsart wird in `freezer` beschrieben; Einkaufsliste und Verlauf berücksichtigen nur ihre bisherigen Eintragsarten und bleiben dadurch unverändert -->

## Impact

- Backend: Tabelle `freezer_items`, neue Eintragsart `freezer` in `plan_entries` (Tabellenumbau wegen CHECK), Endpunkte unter `/api/freezer`, Einstellung `freezerWarnMonths`; „Als Menü speichern“ wandelt Gefrierfach-Einträge um
- Frontend: Seite `/gefrierfach` mit Navigationseintrag, Aktion „Einfrieren“ am Planeintrag, Tab „Gefrierfach“ im Dialog „Hinzufügen“, Hinweis im Plan, Einstellung für die Lagerdauer
- Setzt `add-planner-flexibility`, `add-shopping-list` und `add-menus` voraus
