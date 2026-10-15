-- Einkaufsliste: Artikel bestehen aus Anteilen, deren Mengen beim Lesen zusammengefasst werden.
-- Die eingebauten Kategorien legt der Go-Schritt zu Version 5 an (aus internal/shopping).
CREATE TABLE shopping_categories (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    position     INTEGER NOT NULL,
    -- Kürzel der eingebauten Kategorie, auf das die Vorschläge verweisen
    builtin_slug TEXT UNIQUE
);

CREATE TABLE shopping_stores (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE shopping_items (
    id          TEXT PRIMARY KEY,
    -- Vergleichsschlüssel des Namens (klein, Leerraum zusammengezogen), nach Auflösen der Zusammenführungen
    key         TEXT NOT NULL,
    name        TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES shopping_categories (id),
    store_id    TEXT REFERENCES shopping_stores (id) ON DELETE SET NULL,
    checked     INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX shopping_items_key ON shopping_items (key, checked);

CREATE TABLE shopping_item_parts (
    id           INTEGER PRIMARY KEY,
    item_id      TEXT NOT NULL REFERENCES shopping_items (id) ON DELETE CASCADE,
    quantity     REAL,
    unit         TEXT NOT NULL DEFAULT '',
    source_kind  TEXT NOT NULL CHECK (source_kind IN ('plan', 'manual', 'staple')),
    -- Herkunft aus dem Plan; bewusst ohne Fremdschlüssel, die Liste bleibt, wenn sich der Plan ändert.
    entry_id     TEXT,
    recipe_id    TEXT,
    recipe_title TEXT,
    date         TEXT,
    text         TEXT NOT NULL
);

CREATE INDEX shopping_item_parts_item ON shopping_item_parts (item_id);

-- Bereits übernommene Planeinträge, damit eine zweite Übernahme sie überspringt.
CREATE TABLE shopping_imported_entries (
    entry_id    TEXT PRIMARY KEY REFERENCES plan_entries (id) ON DELETE CASCADE,
    imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Gemerkte Zusammenführungen: Zutaten mit from_key landen beim Artikel to_key.
CREATE TABLE shopping_aliases (
    from_key  TEXT PRIMARY KEY,
    from_name TEXT NOT NULL,
    to_key    TEXT NOT NULL,
    to_name   TEXT NOT NULL
);

-- Gemerkte Kategorie und gemerktes Geschäft je Name.
CREATE TABLE shopping_name_prefs (
    key         TEXT PRIMARY KEY,
    category_id TEXT REFERENCES shopping_categories (id) ON DELETE SET NULL,
    store_id    TEXT REFERENCES shopping_stores (id) ON DELETE SET NULL
);

CREATE TABLE shopping_staples (
    id       TEXT PRIMARY KEY,
    text     TEXT NOT NULL,
    key      TEXT NOT NULL,
    position INTEGER NOT NULL
);

-- Version der Liste; jede Änderung erhöht sie, Clients fragen mit ETag nach.
CREATE TABLE shopping_meta (
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
);

INSERT INTO shopping_meta (id, version) VALUES (1, 1);
