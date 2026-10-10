#!/usr/bin/env python3
"""公式サイト（disneyworld.disney.go.com）の4パークのアトラクション一覧から、
いま「改装中（Refurbishment）」「休止（Closed）」と表示されているものを JSON で出す。
毎朝のニュース巡回（2nd-brain の /wdw-news）が使う。外部ライブラリ不要。

使い方: python3 tools/official_status.py
出力: {"checkedAt": "...", "items": [{"park": "MK", "name": "...", "url": "...", "status": "Refurbishment", "dates": [...]}], "errors": [...]}
"""
import datetime
import json
import re
import urllib.request

PARKS = {"MK": "magic-kingdom", "EP": "epcot", "HS": "hollywood-studios", "AK": "animal-kingdom"}
PARK_NAMES = {
    "Magic Kingdom Park": "MK",
    "EPCOT": "EP",
    "Disney's Hollywood Studios": "HS",
    "Disney's Animal Kingdom Theme Park": "AK",
}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8", "ignore")


def entities(html: str) -> list[dict]:
    m = re.search(r'<script id="ng-state" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        return []
    found: dict[str, dict] = {}

    def walk(o: object) -> None:
        if isinstance(o, dict):
            if "url" in o and "name" in o and "schedule" in o:
                found.setdefault(str(o["url"]), o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(json.loads(m.group(1)))
    return list(found.values())


def main() -> None:
    out: dict[str, object] = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "items": [], "errors": []}
    seen: set[str] = set()
    for code, slug in PARKS.items():
        try:
            html = fetch(f"https://disneyworld.disney.go.com/attractions/{slug}/")
        except Exception as e:  # 1パークの失敗で全体を止めない
            out["errors"].append(f"{code}: {e}")  # type: ignore[union-attr]
            continue
        for o in entities(html):
            park = PARK_NAMES.get(str(o.get("locationName")))
            if not park or o["url"] in seen:
                continue
            sched = str(o.get("schedule"))
            hits = re.findall(r"'type': '(Refurbishment|Closed)'[^}]*?'date': '([^']+)'", sched)
            if not hits:
                continue
            seen.add(o["url"])
            out["items"].append(  # type: ignore[union-attr]
                {
                    "park": park,
                    "name": o["name"],
                    "url": "https://disneyworld.disney.go.com" + str(o["url"]),
                    "status": sorted({h[0] for h in hits}),
                    "dates": sorted({h[1] for h in hits}),
                }
            )
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
