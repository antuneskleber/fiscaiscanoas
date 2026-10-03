CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_name TEXT NOT NULL,
  section INTEGER,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS assignments_location_name_idx
  ON assignments(location_name);
