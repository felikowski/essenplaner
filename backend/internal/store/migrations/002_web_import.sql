-- Rezepte werden beim Entfernen nur ausgeblendet, damit bestehende Pläne lesbar bleiben.
ALTER TABLE recipes ADD COLUMN available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1));

-- Normalisierte Adresse importierter Seiten, um Duplikate zu erkennen.
ALTER TABLE recipes ADD COLUMN canonical_url TEXT;
CREATE UNIQUE INDEX recipes_canonical_url ON recipes (canonical_url) WHERE origin = 'web-import';
