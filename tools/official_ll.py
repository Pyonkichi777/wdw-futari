#!/usr/bin/env python3
"""公式サイトの4パークの一覧から、時短パス（Lightning Lane）の対象を取り出し、
src/data/rides.ts の lightningLane と食い違うものを表示する。出発前の再確認用。外部ライブラリ不要。

公式サイトの属性（2026-10-12 確認）: eA に "mobile-expedited-access-enabled" = Single Pass、"flex-rec" = Multi Pass
使い方: python3 tools/official_ll.py
"""
import json
import pathlib
import re
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"
ROOT = pathlib.Path(__file__).resolve().parent.parent


def entities(url: str) -> list[dict]:
    html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read().decode("utf-8", "ignore")
    m = re.search(r'<script id="ng-state" type="application/json">(.*?)</script>', html, re.S)
    found: dict[str, dict] = {}

    def walk(o: object) -> None:
        if isinstance(o, dict):
            if "url" in o and "name" in o and "facets" in o:
                found.setdefault(str(o["url"]).rstrip("/") + "/", o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    if m:
        walk(json.loads(m.group(1)))
    return list(found.values())


def main() -> None:
    official: dict[str, tuple[str, str]] = {}
    for kind in ("attractions", "entertainment"):
        for park in ("magic-kingdom", "epcot", "hollywood-studios", "animal-kingdom"):
            for o in entities(f"https://disneyworld.disney.go.com/{kind}/{park}/"):
                ea = (o.get("facets") or {}).get("eA") or []
                ll = "single" if "mobile-expedited-access-enabled" in ea else "multi" if "flex-rec" in ea else "none"
                official[str(o["url"]).rstrip("/") + "/"] = (ll, str(o["name"]))
    src = (ROOT / "src/data/rides.ts").read_text(encoding="utf-8")
    mine = dict(re.findall(r'officialPath: "([^"]+)",[\s\S]*?lightningLane: "(\w+)"', src))
    diffs = 0
    for path, ll in mine.items():
        key = path.rstrip("/") + "/"
        if key not in official:
            print(f"公式の一覧に見つからない: {path}")
            continue
        if official[key][0] != ll:
            diffs += 1
            print(f"食い違い: {official[key][1]}  アプリ={ll}  公式={official[key][0]}")
    print(f"照合 {len(mine)}件、食い違い {diffs}件")


if __name__ == "__main__":
    main()
