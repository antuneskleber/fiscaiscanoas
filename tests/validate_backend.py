from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import database  # noqa: E402

with tempfile.TemporaryDirectory() as directory:
    database.DATABASE_PATH = Path(directory) / "test.sqlite3"
    database.initialize()
    records = database.locations()
    assert len(records) == 87
    first = records[0]
    result = database.create_assignment({
        "location_id": first["id"], "section": first["sections"][0], "name": "Teste Operacional", "phone": "51999999999"
    })
    assert result["message"] == "Fiscal cadastrado com sucesso."
    assert next(record for record in database.locations() if record["id"] == first["id"])["registered_count"] == 1

print("Validated SQLite seed, assignment validation, and privacy-safe public count.")
