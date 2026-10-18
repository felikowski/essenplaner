-- Anmeldesitzungen. Gespeichert wird nur der SHA-256-Hash der zufälligen Sitzungs-ID aus dem Cookie.
CREATE TABLE sessions (
    id_hash      TEXT PRIMARY KEY,
    subject      TEXT NOT NULL,
    name         TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    picture      TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
);

CREATE INDEX sessions_last_seen ON sessions (last_seen_at);
