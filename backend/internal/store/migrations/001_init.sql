CREATE TABLE recipes (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    source_kind       TEXT NOT NULL CHECK (source_kind IN ('pdf', 'web')),
    source_ref        TEXT NOT NULL,
    image_url         TEXT,
    servings          TEXT,
    ingredients_json  TEXT,
    instructions_json TEXT,
    origin            TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Ein Tag ohne Zeile ist nicht belegt.
CREATE TABLE plan_days (
    date      TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes (id)
);
