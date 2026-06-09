"""Fetch and cache gram panchayat -> village mappings from villageinfo.in."""
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "_panchayat_cache"

ROW_RE = re.compile(
    r"<tr><td>\d+</td><td>(?:<a[^>]*>)?([^<]+)(?:</a>)?</td><td>([^<]+)</td><td>([^<]+)</td></tr>",
    re.I,
)


def slugify(text):
    text = (text or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    return text.strip("-")


def cache_path(census_district, mandal):
    return CACHE_DIR / f"{slugify(census_district)}_{slugify(mandal)}.json"


def fetch_mandal_panchayats(census_district, mandal, delay=0.15):
    """Return {panchayat: [villages]} for a mandal."""
    mandal_clean = re.sub(r"\s+Mandal$", "", mandal, flags=re.I).strip()
    path = cache_path(census_district, mandal_clean)
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("panchayats", {})

    url = (
        f"https://villageinfo.in/andhra-pradesh/"
        f"{slugify(census_district)}/{slugify(mandal_clean)}/"
    )
    panchayats = {}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="ignore")
        for village, _category, gp in ROW_RE.findall(html):
            village = village.strip()
            gp = gp.strip()
            if not village:
                continue
            if not gp or gp.lower() in ("not applicable", "unmapped", "-"):
                gp = village
            panchayats.setdefault(gp, [])
            if village not in panchayats[gp]:
                panchayats[gp].append(village)
        time.sleep(delay)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        pass

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "district": census_district,
                "mandal": mandal_clean,
                "url": url,
                "panchayats": panchayats,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return panchayats
