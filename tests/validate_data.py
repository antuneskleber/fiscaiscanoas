from pathlib import Path
import json

data_path = Path(__file__).parents[1] / "frontend" / "public" / "data.json"
records = json.loads(data_path.read_text(encoding="utf-8"))

assert len(records) == 87
assert sum(len(record["sections"]) for record in records) == 755
assert all(record["name"] and record["address"] and record["zone"] in {"66", "134"} for record in records)
assert all(len(record["pages"]) == 1 and record["pages"][0] > 0 for record in records)

print("Validated 87 locations, 755 sections, and one source page per location.")
