-- Interior Design Matching Platform: SQLite schema.
-- Applied on every start; every statement is idempotent (IF NOT EXISTS).
-- Timestamps are UTC text in the form 'YYYY-MM-DD HH:MM:SS'.

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL
                  CHECK (role IN ('Customer', 'Interior Designer', 'User Admin', 'Platform Management')),
    status        TEXT    NOT NULL DEFAULT 'Active'
                  CHECK (status IN ('Active', 'Pending', 'Suspended', 'Deactivated')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Public-facing information, one row per user (account = private, profile = public).
CREATE TABLE IF NOT EXISTS profiles (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    phone       TEXT,
    description TEXT,
    location    TEXT,
    services    TEXT
);

-- Company credentials submitted by interior designers for approval.
CREATE TABLE IF NOT EXISTS credentials (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name        TEXT    NOT NULL,
    registration_number TEXT    NOT NULL,
    status              TEXT    NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    submitted_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    reviewed_at         TEXT
);

CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    designer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'Current' CHECK (status IN ('Current', 'Past')),
    year        INTEGER,
    image_path  TEXT,                       -- nullable: the UI falls back to a placeholder
    view_count  INTEGER NOT NULL DEFAULT 0, -- +1 every time the detail page is opened
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Shortlist (favourite) counts are computed from this table, never stored.
CREATE TABLE IF NOT EXISTS favourites (
    customer_id INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (customer_id, project_id)
);

CREATE TABLE IF NOT EXISTS enquiries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    designer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    name         TEXT,
    email        TEXT,
    location     TEXT,
    budget       TEXT,
    requirements TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per browser session that opens the site (story 55).
CREATE TABLE IF NOT EXISTS site_visits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    visited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_category   ON projects(category_id);
CREATE INDEX IF NOT EXISTS idx_projects_designer   ON projects(designer_id);
CREATE INDEX IF NOT EXISTS idx_favourites_project  ON favourites(project_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_designer  ON enquiries(designer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user    ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_time    ON site_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_users_role_status   ON users(role, status);
