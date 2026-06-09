"""Patch Palnadu assembly constituencies with official village/panchayat CSV data."""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "palnadu_constituency_villages.csv"
LOCATIONS_PATH = ROOT / "data" / "ap-locations.json"

ASSEMBLY_MAP = {
    "CHILAKALURIPET": "Chilakaluripet",
    "NARASARAOPET": "Narasaraopet",
    "SATTENAPALLI": "Sattenapalle",
    "VINUKONDA": "Vinukonda",
    "GURZALA": "Gurajala",
    "MACHERLA": "Macherla",
}

PALNADU_PC = "Narasaraopet"


def format_village(name):
    name = (name or "").strip()
    if not name:
        return name
    if name.isupper() or name.islower():
        return name.title()
    return name


def panchayat_key(name, assembly_ac):
    name = (name or "").strip()
    if name:
        return name
    return f"{assembly_ac} (Unassigned)"


def build_ac_node(rows):
    groups = defaultdict(lambda: defaultdict(dict))
    for row in rows:
        panchayat = panchayat_key(row["Panchayat"], row["_ac"])
        village = format_village(row["Village"])
        if not village:
            continue
        groups[panchayat][panchayat][village] = {}

    node = {}
    for panchayat, panchayat_map in sorted(groups.items()):
        node[panchayat] = dict(panchayat_map)
    return node


def find_ac_pc(tree, ac_name):
    parliaments = tree.get("Andhra Pradesh", {}).get("parliaments", {})
    for pc, acs in parliaments.items():
        if ac_name in acs:
            return pc
    return None


def main():
    by_assembly = defaultdict(list)
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            ac_csv = row["Assembly"].strip().upper()
            ac_name = ASSEMBLY_MAP.get(ac_csv)
            if not ac_name:
                print(f"Skipping unknown assembly: {ac_csv}")
                continue
            row["_ac"] = ac_name
            by_assembly[ac_name].append(row)

    tree = json.loads(LOCATIONS_PATH.read_text(encoding="utf-8"))
    parliaments = tree["Andhra Pradesh"]["parliaments"]
    updated = []

    for ac_name, rows in by_assembly.items():
        pc = find_ac_pc(tree, ac_name) or PALNADU_PC
        if ac_name not in parliaments.get(pc, {}):
            print(f"AC not found in locations tree: {ac_name} under {pc}")
            continue
        parliaments[pc][ac_name] = build_ac_node(rows)
        panchayats = len(parliaments[pc][ac_name])
        villages = sum(len(v) for m in parliaments[pc][ac_name].values() for v in m.values())
        updated.append((ac_name, panchayats, villages, len(rows)))

    LOCATIONS_PATH.write_text(
        json.dumps(tree, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Updated {LOCATIONS_PATH}")
    for ac_name, panchayats, villages, rows in updated:
        print(f"  {ac_name}: {panchayats} panchayats, {villages} villages ({rows} CSV rows)")


if __name__ == "__main__":
    main()
