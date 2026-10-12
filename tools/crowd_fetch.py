#!/usr/bin/env python3
"""Magic Tips の混雑予想（パーク別・日別）を取り込み、public/crowd.json を書く。外部ライブラリ不要。

- 取得元: Magic Tips の公開 MCP サーバー（https://magic-tips.app/api/mcp、認証なし、1分60回まで）の get_crowd_forecast
  - Magic Tips は AI による取得・引用を robots.txt（ai-input=yes）と llms.txt で認めている。条件は「出典ページへのリンクを示すこと」
- 値: 各パークの「過去の混雑のピーク」に対する割合（0〜100%）。Magic Tips の区分は 静か <36% / ふつう 36–50% / 混む 51–75% / とても混む >75%
- 毎朝のニュース巡回（2nd-brain の /wdw-news）が使う

使い方: python3 tools/crowd_fetch.py [--check]
  --check: 書き込まずに、前回からの変化だけ出す
出力（最終行）: {"ok": true, "changed": [...], "path": "public/crowd.json"} または {"ok": false, "error": "..."}
"""
import datetime
import json
import os
import sys
import urllib.request

MCP = "https://magic-tips.app/api/mcp"
DATES = ["2027-04-30", "2027-05-01", "2027-05-02", "2027-05-03", "2027-05-04", "2027-05-05", "2027-05-06"]
PARKS = {"magic-kingdom": "MK", "epcot": "EP", "disneys-hollywood-studios": "HS", "disneys-animal-kingdom": "AK"}
SOURCE_URL = "https://magic-tips.app/ja/konzatsu-calendar/walt-disney-world/2027/05"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "crowd.json")


def band(v: float) -> str:
    return "low" if v < 36 else "mid" if v <= 50 else "high" if v <= 75 else "peak"


def call(name: str, args: dict) -> dict:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": args}}).encode()
    req = urllib.request.Request(
        MCP,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream", "User-Agent": "wdw-futari/1.0 (personal trip planner)"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        text = res.read().decode("utf-8", "ignore")
    for line in text.splitlines():
        if line.startswith("data:"):
            msg = json.loads(line[5:])
            if "error" in msg:
                raise RuntimeError(str(msg["error"]))
            r = msg["result"]
            return r.get("structuredContent") or json.loads(r["content"][0]["text"])
    raise RuntimeError("MCP の応答に data 行がありません")


def main() -> None:
    check = "--check" in sys.argv
    days: dict[str, dict[str, float]] = {}
    for year, month in sorted({(int(d[:4]), int(d[5:7])) for d in DATES}):
        sc = call("get_crowd_forecast", {"resort": "walt-disney-world", "year": year, "month": month})
        for park in sc.get("data", []):
            pid = PARKS.get(park.get("parkSlug"))
            if not pid:
                continue
            for row in park.get("data", []):
                v = row.get("percentage")
                if row.get("date") in DATES and isinstance(v, (int, float)) and 0 <= v <= 100:
                    days.setdefault(row["date"], {})[pid] = round(float(v), 1)
    missing = [f"{d} {p}" for d in DATES for p in PARKS.values() if p not in days.get(d, {})]
    if len(missing) == len(DATES) * len(PARKS):
        print(json.dumps({"ok": False, "error": "値が1つも取れませんでした"}, ensure_ascii=False))
        sys.exit(1)

    old = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f).get("days", {})
    changed = []
    for d in DATES:
        for p in PARKS.values():
            a, b = old.get(d, {}).get(p), days.get(d, {}).get(p)
            if b is not None and (a is None or band(a) != band(b)):
                changed.append({"date": d, "park": p, "from": a, "to": b, "fromBand": band(a) if a is not None else None, "toBand": band(b)})

    feed = {
        "source": {"name": "Magic Tips", "url": SOURCE_URL},
        "fetchedAt": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d"),
        "method": "AIによる混雑予想。各パークの過去の混雑ピークに対する割合（%）。予想であり保証ではない",
        "scale": 100,
        "bands": [36, 51, 76],
        "days": days,
    }
    if not check:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(feed, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(json.dumps({"ok": True, "changed": changed, "missing": missing, "path": "public/crowd.json", "written": not check}, ensure_ascii=False))


if __name__ == "__main__":
    main()
