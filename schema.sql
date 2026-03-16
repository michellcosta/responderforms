-- D1 schema para Briefing Safety
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cargo TEXT,
  empresa TEXT,
  tema TEXT,
  op TEXT,
  site TEXT,
  at TEXT
);

INSERT OR IGNORE INTO session (id) VALUES (1);
