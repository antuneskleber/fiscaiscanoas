"""Gera public/locais.json a partir do CSV oficial do TSE (seções eleitorais de Canoas/RS)."""
import csv, json, sys
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Automa\fiscais-canoas\secoes_eleitorais_canoas_rs_2026.csv")
out = Path(__file__).resolve().parent.parent / "src" / "locais.json"

locais = {}
with src.open(encoding="utf-8-sig") as f:
    for r in csv.DictReader(f, delimiter=";"):
        if r["DS_TIPO_LOCAL"] == "Preso provisório":
            continue
        key = (int(r["NR_ZONA"]), int(r["NR_LOCAL_VOTACAO"]))
        loc = locais.setdefault(key, {
            "zona": key[0], "id": key[1],
            "nome": r["NM_LOCAL_VOTACAO"].strip(),
            "endereco": r["DS_ENDERECO"].strip().title(),
            "bairro": r["NM_BAIRRO"].strip().title(),
            "secoes": [],
        })
        loc["secoes"].append(int(r["NR_SECAO"]))

data = sorted(locais.values(), key=lambda l: (l["zona"], l["nome"]))
for l in data:
    l["secoes"].sort()
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(data)} locais, {sum(len(l['secoes']) for l in data)} seções -> {out}")
