## ADDED Requirements

### Requirement: Rezept aus dem Katalog einplanen
Das System SHALL es ermöglichen, ein Rezept von der Rezeptliste und von der Detailansicht aus über einen Dialog „Einplanen“ direkt einem Tag und einer Mahlzeit im Wochenplan hinzuzufügen. Der Dialog MUST die sieben Tage einer Kalenderwoche zur Auswahl anbieten, mit der aktuellen Woche beginnen, heute vorauswählen und das Wechseln zur vorigen und nächsten Woche erlauben. Zusätzlich MUST jedes beliebige Datum wählbar sein. Zur Wahl MUST nur die in den Haushaltseinstellungen sichtbaren Mahlzeiten stehen. Die Mahlzeit MUST mit Abendessen vorbelegt sein, sofern diese Mahlzeit in den Haushaltseinstellungen sichtbar ist, sonst mit der ersten sichtbaren Mahlzeit. Die Portionen MUST mit den in der Detailansicht gewählten Portionen vorbelegt sein, sonst mit denen des Rezepts, und MUST änderbar sein; hat das Rezept keine Portionen, MUST der Eintrag ohne Portionenzahl gespeichert werden. Das neue Rezept MUST als letzter Eintrag der gewählten Mahlzeit erscheinen. Nach dem Einplanen MUST der Nutzer auf der aktuellen Seite bleiben und einen Hinweis mit Tag, Mahlzeit und einem Link zur betreffenden Woche sehen. Nicht mehr verfügbare Rezepte MUST NOT eingeplant werden können.

#### Scenario: Aus der Detailansicht einplanen
- **WHEN** der Nutzer in der Detailansicht von „Linsensuppe“ (6 Portionen) „Einplanen“ tippt, Mittwoch 21.10. wählt und bestätigt
- **THEN** steht „Linsensuppe“ mit 6 Portionen beim Abendessen am 21.10., und die Detailansicht zeigt „Für Mi 21.10. · Abendessen eingeplant“ mit Link zur Woche

#### Scenario: Aus der Rezeptliste einplanen
- **WHEN** der Nutzer in der Rezeptliste bei „Hähnchen-Curry“ das Kalender-Symbol tippt und bestätigt
- **THEN** steht „Hähnchen-Curry“ heute beim Abendessen, und die Rezeptliste bleibt mit Suchbegriff und Filtern sichtbar

#### Scenario: Andere Woche
- **WHEN** der Nutzer im Dialog zur nächsten Woche blättert und dort Montag wählt
- **THEN** plant das System das Rezept für den Montag der nächsten Woche ein

#### Scenario: Gewählte Portionen übernehmen
- **WHEN** der Nutzer in der Detailansicht von „Linsensuppe“ (Rezept: 6) 8 Portionen gewählt hat und „Einplanen“ öffnet
- **THEN** ist der Dialog mit 8 Portionen vorbelegt

#### Scenario: Abendessen ausgeblendet
- **WHEN** in den Haushaltseinstellungen nur Frühstück und Mittagessen sichtbar sind und der Nutzer „Einplanen“ öffnet
- **THEN** ist Frühstück vorausgewählt

#### Scenario: Abbrechen
- **WHEN** der Nutzer den Dialog „Einplanen“ ohne Bestätigen schließt
- **THEN** bleibt der Wochenplan unverändert

#### Scenario: Speichern schlägt fehl
- **WHEN** das Einplanen nicht gespeichert werden kann
- **THEN** bleibt der Dialog offen und zeigt eine Fehlermeldung, die Auswahl bleibt erhalten

#### Scenario: Entferntes Rezept
- **WHEN** der Nutzer die Detailansicht eines nicht mehr verfügbaren Rezepts öffnet
- **THEN** bietet die Ansicht „Einplanen“ nicht an
