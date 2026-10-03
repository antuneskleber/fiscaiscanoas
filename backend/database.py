"""SQLite persistence for Fiscais Canoas."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = ROOT / "backend" / "storage" / "fiscaiscanoas.sqlite3"
SEED_PATH = ROOT / "frontend" / "public" / "data.json"


@contextmanager
def connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def initialize() -> None:
    with connection() as conn:
        columns = {row["name"]: row for row in conn.execute("PRAGMA table_info(assignments)")}
        if columns and ("source_local" not in columns or columns["location_id"]["notnull"] or columns["section"]["notnull"] or columns["phone"]["notnull"]):
            conn.executescript("""
                ALTER TABLE assignments RENAME TO assignments_legacy;
                CREATE TABLE assignments (
                    id INTEGER PRIMARY KEY,
                    location_id INTEGER REFERENCES locations(id) ON DELETE RESTRICT,
                    section INTEGER,
                    source_local TEXT NOT NULL,
                    name TEXT NOT NULL,
                    phone TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE (location_id, section, phone)
                );
                INSERT INTO assignments(id, location_id, section, source_local, name, phone, created_at)
                SELECT legacy.id, legacy.location_id, legacy.section, COALESCE(locations.name, 'Local não especificado'), legacy.name, legacy.phone, legacy.created_at
                FROM assignments_legacy AS legacy LEFT JOIN locations ON locations.id = legacy.location_id;
                DROP TABLE assignments_legacy;
            """)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY,
                zone TEXT NOT NULL,
                name TEXT NOT NULL UNIQUE,
                address TEXT NOT NULL,
                source_page INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS location_sections (
                location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
                section INTEGER NOT NULL,
                PRIMARY KEY (location_id, section)
            );
            CREATE TABLE IF NOT EXISTS assignments (
                id INTEGER PRIMARY KEY,
                location_id INTEGER REFERENCES locations(id) ON DELETE RESTRICT,
                section INTEGER,
                source_local TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                created_at TEXT NOT NULL,
                UNIQUE (location_id, section, phone)
            );
            CREATE INDEX IF NOT EXISTS assignments_location_section_idx
                ON assignments(location_id, section);
        """)
        if conn.execute("SELECT COUNT(*) FROM locations").fetchone()[0]:
            return
        for location in json.loads(SEED_PATH.read_text(encoding="utf-8")):
            cursor = conn.execute(
                "INSERT INTO locations(zone, name, address, source_page) VALUES (?, ?, ?, ?)",
                (location["zone"], location["name"], location["address"], location["pages"][0]),
            )
            conn.executemany(
                "INSERT INTO location_sections(location_id, section) VALUES (?, ?)",
                [(cursor.lastrowid, section) for section in location["sections"]],
            )


def locations() -> list[dict]:
    with connection() as conn:
        rows = conn.execute("SELECT id, zone, name, address, source_page FROM locations ORDER BY name").fetchall()
        section_rows = conn.execute("SELECT location_id, section FROM location_sections ORDER BY section").fetchall()
        count_rows = conn.execute("SELECT location_id, COUNT(*) AS count FROM assignments GROUP BY location_id").fetchall()
    sections_by_location: dict[int, list[int]] = {}
    for row in section_rows:
        sections_by_location.setdefault(row["location_id"], []).append(row["section"])
    counts = {row["location_id"]: row["count"] for row in count_rows}
    return [{
        "id": row["id"], "zone": row["zone"], "name": row["name"], "address": row["address"],
        "pages": [row["source_page"]], "sections": sections_by_location.get(row["id"], []),
        "registered_count": counts.get(row["id"], 0),
    } for row in rows]


def create_assignment(payload: dict) -> dict:
    raw_location = payload.get("location_id")
    try:
        location_id = int(raw_location) if raw_location not in (None, "") else None
        section = int(payload.get("section")) if payload.get("section") not in (None, "") else None
    except (TypeError, ValueError) as error:
        raise ValueError("Local ou seção inválidos.") from error
    name = " ".join(str(payload.get("name", "")).split())
    phone = re.sub(r"\D", "", str(payload.get("phone", ""))) or None
    if len(name) < 3:
        raise ValueError("Informe um nome válido.")
    if phone and not 10 <= len(phone) <= 13:
        raise ValueError("Informe um telefone com DDD válido.")

    with connection() as conn:
        source_local = " ".join(str(payload.get("source_local", "")).split())
        if location_id:
            location = conn.execute("SELECT name FROM locations WHERE id = ?", (location_id,)).fetchone()
            if not location:
                raise ValueError("Local não encontrado.")
            source_local = location["name"]
            if section:
                allowed = conn.execute(
                    "SELECT 1 FROM location_sections WHERE location_id = ? AND section = ?", (location_id, section)
                ).fetchone()
                if not allowed:
                    raise ValueError("A seção não pertence ao local selecionado.")
        elif len(source_local) < 3:
            raise ValueError("Informe um local válido.")
        try:
            conn.execute(
                "INSERT INTO assignments(location_id, section, source_local, name, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (location_id, section, source_local, name, phone, datetime.now(timezone.utc).isoformat()),
            )
        except sqlite3.IntegrityError as error:
            raise ValueError("Este telefone já está cadastrado para esta seção.") from error
    return {"message": "Fiscal cadastrado com sucesso."}
