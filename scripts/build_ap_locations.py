"""Build Andhra Pradesh location hierarchy for the registration form."""
import json
import re
import urllib.request
from pathlib import Path

from panchayat_source import fetch_mandal_panchayats

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SCHEDULE_PATH = DATA_DIR / "_delimitation_schedule.txt"
CONSTITUENCIES_PATH = DATA_DIR / "_ap_constituencies.json"
VILLAGES_PATH = DATA_DIR / "_ap_villages_raw.json"
OUTPUT_PATH = DATA_DIR / "ap-locations.json"

PC_CANONICAL = {
    "Araku": "Araku (ST)",
    "Amalapuram": "Amalapuram (SC)",
    "Bapatla": "Bapatla (SC)",
    "Tirupati": "Tirupati (SC)",
    "Chittoor": "Chittoor (SC)",
}


def canonical_pc(name):
    return PC_CANONICAL.get(name, name)


def normalize_name(name):
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def clean_ac_name(name):
    return re.sub(r"\s*\((SC|ST)\)\s*$", "", name, flags=re.I).strip()


def clean_mandal_name(name):
    return re.sub(r"\s+Mandal$", "", (name or ""), flags=re.I).strip()


def extract_mandals(extent_text):
    text = re.sub(r"\s+", " ", extent_text or "")
    text = re.sub(r"\b\d+-DISTRICT:.*$", "", text, flags=re.I)
    if not text.strip():
        return []

    if re.search(r"Ward No", text, re.I) and not re.search(r"Mandals?", text, re.I):
        urban = re.search(r"([A-Za-z0-9 .\-]+?)\s+(?:\(Urban\)\s+)?Mandal", text, re.I)
        return [urban.group(1).strip()] if urban else []

    core = text
    for stop in ("(Part)", "(Except", "(Including", "Ward No", "Villages"):
        core = core.split(stop)[0]
    core = core.strip(" ,.;")
    core = re.sub(r"\s+and\s+", ", ", core, flags=re.I)
    core = re.sub(r"\s+Mandals?\.?$", "", core, flags=re.I).strip(" ,.;")

    mandals = []
    for chunk in re.split(r",", core):
        chunk = chunk.strip(" ,.;")
        chunk = re.sub(r"\s+Mandals?\.?$", "", chunk, flags=re.I).strip(" ,.;")
        if chunk and len(chunk) > 1:
            mandals.append(chunk)

    seen = set()
    unique = []
    for m in mandals:
        key = normalize_name(m)
        if key and key not in seen:
            seen.add(key)
            unique.append(m)
    return unique


def parse_schedule(path):
    text = path.read_text(encoding="utf-8", errors="ignore")
    start = text.find("TABLE A - ASSEMBLY CONSTITUENCIES")
    end = text.find("TABLE B - PARLIAMENTARY CONSTITUENCIES")
    if start == -1:
        raise RuntimeError("Could not find assembly table in schedule")
    block = text[start:end if end != -1 else None]

    lines = [ln.strip() for ln in block.splitlines()]
    ac_mandals = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^\d+\.$", line):
            i += 1
            while i < len(lines) and not lines[i]:
                i += 1
            if i >= len(lines):
                break
            ac_name = clean_ac_name(lines[i])
            i += 1
            extent_parts = []
            while i < len(lines):
                if re.match(r"^\d+\.$", lines[i]):
                    break
                if re.match(r"^\d+-DISTRICT:", lines[i], re.I):
                    i += 1
                    continue
                if lines[i] in ("Name", "Extent of Assembly Constituencies", "Sl. No."):
                    i += 1
                    continue
                if lines[i]:
                    extent_parts.append(lines[i])
                i += 1
            extent = " ".join(extent_parts)
            mandals = extract_mandals(extent)
            if mandals:
                ac_mandals[ac_name] = mandals
            continue
        i += 1
    return ac_mandals


def match_schedule_to_constituency(schedule_ac_mandals, constituency_rows):
    ac_names = sorted({row["ac_name"] for row in constituency_rows})
    by_norm = {normalize_name(clean_ac_name(ac)): ac for ac in ac_names}
    matched = {}
    for sched_ac, mandals in schedule_ac_mandals.items():
        key = normalize_name(clean_ac_name(sched_ac))
        ac = by_norm.get(key, clean_ac_name(sched_ac))
        matched[ac] = mandals
    return matched


def load_mandal_indexes():
    data = json.loads(VILLAGES_PATH.read_text(encoding="utf-8"))
    district_villages = {}
    mandal_districts = {}
    for district_block in data.get("districts", []):
        census_district = district_block["district"]
        for sub in district_block.get("subDistricts", []):
            mandal = sub["subDistrict"]
            villages = sub.get("villages", [])
            key = normalize_name(mandal)
            district_villages[(census_district, mandal)] = villages
            mandal_districts.setdefault(key, []).append(census_district)
    return district_villages, mandal_districts


def resolve_census_district(mandal, ac_district, mandal_districts):
    mandal_key = normalize_name(clean_mandal_name(mandal))
    matches = mandal_districts.get(mandal_key, [])
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]

    preferred = {
        "Palnadu": "Guntur",
        "NTR": "Krishna",
        "Bapatla": "Guntur",
        "Ananthapuramu": "Anantapur",
        "Sri Sathya Sai": "Anantapur",
        "Annamayya": "Kadapa",
        "Dr. B.R. Ambedkar Konaseema": "East Godavari",
        "Konaseema": "East Godavari",
        "Kakinada": "East Godavari",
        "Eluru": "West Godavari",
        "Parvathipuram Manyam": "Vizianagaram",
        "Alluri Sitharama Raju": "Visakhapatnam",
        "Anakapalli": "Visakhapatnam",
        "Nandyal": "Kurnool",
        "Tirupati": "Chittoor",
        "YSR Kadapa": "Kadapa",
        "Sri Potti Sriramulu Nellore": "Nellore",
    }
    if ac_district in preferred and preferred[ac_district] in matches:
        return preferred[ac_district]
    return matches[0]


def build_mandal_node(mandal, ac_district, district_villages, mandal_districts):
    mandal_clean = clean_mandal_name(mandal)
    census_district = resolve_census_district(mandal_clean, ac_district, mandal_districts)
    if not census_district:
        census_district = ac_district

    panchayat_map = fetch_mandal_panchayats(census_district, mandal_clean)
    fallback_villages = district_villages.get((census_district, mandal_clean), [])

    if not panchayat_map and fallback_villages:
        panchayat_map = {v: [v] for v in fallback_villages}

    node = {}
    for panchayat, villages in sorted(panchayat_map.items()):
        village_objs = {v: {} for v in sorted(set(villages))}
        node.setdefault(mandal_clean, {})
        node[mandal_clean][panchayat] = village_objs

    if not node and fallback_villages:
        node[mandal_clean] = {mandal_clean: {v: {} for v in fallback_villages}}

    return node


def build_locations():
    if not CONSTITUENCIES_PATH.exists():
        urllib.request.urlretrieve(
            "https://raw.githubusercontent.com/satishvmadala/andhrapradesh_opendata_locations/main/Final_Andhra_Constituencies_2024.json",
            CONSTITUENCIES_PATH,
        )
    if not VILLAGES_PATH.exists():
        urllib.request.urlretrieve(
            "https://raw.githubusercontent.com/pranshumaheshwari/indian-cities-and-villages/master/By%20States/Andhra%20Pradesh.json",
            VILLAGES_PATH,
        )
    if not SCHEDULE_PATH.exists():
        schedule_url = (
            "https://www.advocatekhoj.com/library/bareacts/apreorganisation/schedule2.php"
            "?STitle=%3ESecond+Schedule&Title=Andhra"
        )
        html = urllib.request.urlopen(schedule_url, timeout=60).read().decode("utf-8", errors="ignore")
        SCHEDULE_PATH.write_text(html, encoding="utf-8")

    constituencies = json.loads(CONSTITUENCIES_PATH.read_text(encoding="utf-8"))
    ac_mandals = match_schedule_to_constituency(
        parse_schedule(SCHEDULE_PATH), constituencies
    )
    district_villages, mandal_districts = load_mandal_indexes()

    districts = sorted({row["district_name"] for row in constituencies})
    district_parliaments = {}
    for row in constituencies:
        district = row["district_name"]
        pc = canonical_pc(row["loksabha_constituency_name"])
        district_parliaments.setdefault(district, set()).add(pc)
    district_parliaments = {
        district: sorted(pcs) for district, pcs in sorted(district_parliaments.items())
    }

    tree = {
        "Andhra Pradesh": {
            "districts": districts,
            "districtParliaments": district_parliaments,
            "parliaments": {},
        }
    }
    parliaments = tree["Andhra Pradesh"]["parliaments"]

    fetched = set()
    for row in constituencies:
        pc = canonical_pc(row["loksabha_constituency_name"])
        ac = row["ac_name"]
        ac_district = row["district_name"]
        parliaments.setdefault(pc, {})
        parliaments[pc].setdefault(ac, {})

        mandals = ac_mandals.get(ac, [])
        if not mandals:
            mandals = [ac]

        for mandal in mandals:
            key = (ac_district, clean_mandal_name(mandal))
            if key in fetched:
                continue
            fetched.add(key)
            mandal_node = build_mandal_node(
                mandal, ac_district, district_villages, mandal_districts
            )
            for mandal_key, panchayats in mandal_node.items():
                parliaments[pc][ac].setdefault(mandal_key, {})
                parliaments[pc][ac][mandal_key].update(panchayats)

    OUTPUT_PATH.write_text(json.dumps(tree, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    patch_script = ROOT / "scripts" / "patch_palnadu_locations.py"
    if patch_script.exists():
        import importlib.util
        spec = importlib.util.spec_from_file_location("patch_palnadu", patch_script)
        patch_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(patch_mod)
        patch_mod.main()

    stats = {
        "districts": len(districts),
        "parliaments": len(parliaments),
        "acs": sum(len(ac) for ac in parliaments.values()),
        "mandals": sum(len(m) for ac in parliaments.values() for m in ac.values()),
        "panchayats": sum(
            len(p) for ac in parliaments.values() for m in ac.values() for p in m.values()
        ),
        "villages": sum(
            len(v)
            for ac in parliaments.values()
            for m in ac.values()
            for p in m.values()
            for v in p.values()
        ),
    }
    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size // 1024} KB)")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    build_locations()
