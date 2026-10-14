## MODIFIED Requirements

### Requirement: Rezepte abrufen
Das System SHALL unter `GET /api/recipes` alle Rezepte als JSON-Array liefern, nach Titel sortiert. Unter `GET /api/recipes/{id}` MUST ein einzelnes Rezept geliefert werden. Jedes Rezept MUST `id`, `title` und `source` enthalten, wobei `source.kind` den Wert `pdf`, `web` oder `manual` hat. `servings` MUST eine ganze Zahl sein. `ingredients` MUST eine Liste von Objekten sein, jedes mit `text` (die eingegebene Zeile) und `name`, dazu `quantity` (Zahl), `unit` und `note`, soweit erkannt. `instructions` MUST eine Liste von Strings sein. Die Felder `imageUrl`, `servings`, `ingredients` und `instructions` sowie `quantity`, `unit` und `note` innerhalb einer Zutat MUST fehlen, wenn keine Angabe vorhanden ist.

#### Scenario: Liste
- **WHEN** ein Client `GET /api/recipes` aufruft
- **THEN** antwortet das System mit Status 200 und einem nach Titel sortierten Array von Rezepten

#### Scenario: Strukturierte Zutat
- **WHEN** ein Rezept die Zutat „200 g Mehl“ hat
- **THEN** enthält `ingredients` das Objekt `{"text": "200 g Mehl", "quantity": 200, "unit": "g", "name": "Mehl"}`

#### Scenario: Unbekannte ID
- **WHEN** ein Client `GET /api/recipes/does-not-exist` aufruft
- **THEN** antwortet das System mit Status 404 und einem Fehlerobjekt
