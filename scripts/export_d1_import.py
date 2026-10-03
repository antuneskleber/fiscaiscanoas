"""Export the private local SQLite assignments to a Cloudflare D1 batch file."""

from __future__ import annotations

import json
from pathlib import Path
import sqlite3
import sys


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: export_d1_import.py <destination.json>")

    root = Path(__file__).resolve().parents[1]
    source = root / "backend" / "storage" / "fiscaiscanoas.sqlite3"
    destination = Path(sys.argv[1])
    with sqlite3.connect(source) as connection:
        rows = connection.execute(
            "SELECT source_local, section, name, phone, created_at FROM assignments ORDER BY id"
        ).fetchall()
    batch = [
        {
            "sql": "INSERT INTO assignments (location_name, section, name, phone, created_at) VALUES (?, ?, ?, ?, ?)",
            "params": list(row),
        }
        for row in rows
    ]
    destination.write_text(json.dumps(batch, ensure_ascii=False), encoding="utf-8")
    print(f"Prepared {len(rows)} operational assignments for the hosted database.")


if __name__ == "__main__":
    main()
