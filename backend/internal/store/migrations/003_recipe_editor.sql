-- Rezepte bekommen die Quellenart 'manual' (eigene Rezepte), Portionen als Zahl und merken sich, welche
-- Felder von Hand bearbeitet wurden. SQLite kann CHECKs nicht ändern, daher wird die Tabelle neu aufgebaut.
-- Portionen und Zutaten wandelt der Go-Schritt migrateRecipeEditor um, danach ersetzt er die alte Tabelle.
CREATE TABLE recipes_new (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    source_kind       TEXT NOT NULL CHECK (source_kind IN ('pdf', 'web', 'manual')),
    source_ref        TEXT NOT NULL DEFAULT '',
    image_url         TEXT,
    servings          INTEGER CHECK (servings BETWEEN 1 AND 99),
    ingredients_json  TEXT,
    instructions_json TEXT,
    origin            TEXT NOT NULL,
    available         INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    canonical_url     TEXT,
    -- JSON-Liste der von Hand geänderten Felder, zum Beispiel ["ingredients"]
    edited_fields     TEXT NOT NULL DEFAULT '[]',
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO recipes_new (id, title, source_kind, source_ref, image_url, instructions_json, origin, available,
                         canonical_url, created_at, updated_at)
SELECT id, title, source_kind, source_ref, image_url, instructions_json, origin, available,
       canonical_url, created_at, updated_at
FROM recipes;
