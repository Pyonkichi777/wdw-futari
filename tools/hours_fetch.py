#!/usr/bin/env python3
"""4パークの営業時間（開園・閉園・開園前入園）を ThemeParks.wiki の公開API から取り込み、public/hours.json を書く。
ThemeParks.wiki はディズニーの公式アプリ・サイトの営業時間をそのまま配信している（認証なし）。
公式の営業時間は、だいたい1〜2ヶ月前にならないと出ない。旅行の日の分が1つも出ていなければ何も書かない。
毎朝のニュース巡回（2nd-brain の /wdw-news）が使う。外部ライブラリ不要。

使い方: python3 tools/hours_fetch.py
出力（最終行）: {"ok": true, "found": 0, "written": false} など
"""
import datetime
import json
import os
import urllib.request

API = "https://api.themeparks.wiki/v1/entity/{id}/schedule/{y}/{m:02d}"
PARKS = {
    "MK": "75ea578a-adc8-4116-a54d-dccb60765ef9",
    "EP": "47f90d2c-e191-4239-a466-5892ef59a88b",
    "HS": "288747d1-8b4f-4a64-867e-ea7c9b27bad8",
    "AK": "1c84a229-8862-4648-9c71-378ddd2c7693",
}
DATES = ["2027-04-30", "2027-05-01", "2027-05-02", "2027-05-03", "2027-05-04", "2027-05-05", "2027-05-06"]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "hours.json")


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "wdw-futari/1.0 (personal trip planner)"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode("utf-8"))


def hm(iso: str) -> str:
    return iso[11:16]  # 現地時刻の "HH:MM"（オフセット付きの現地時刻で返ってくる）


def main() -> None:
    days: dict[str, dict[str, dict[str, str]]] = {}
    for pid, eid in PARKS.items():
        for y, m in sorted({(int(d[:4]), int(d[5:7])) for d in DATES}):
            for row in get(API.format(id=eid, y=y, m=m)).get("schedule", []):
                d = row.get("date")
                if d not in DATES or not row.get("openingTime") or not row.get("closingTime"):
                    continue
                slot = days.setdefault(d, {}).setdefault(pid, {})
                desc = (row.get("description") or "").lower()
                if row.get("type") == "OPERATING":
                    slot["open"], slot["close"] = hm(row["openingTime"]), hm(row["closingTime"])
                elif "early" in desc:
                    slot["early"] = hm(row["openingTime"])
                elif "extended" in desc:
                    slot["extendedClose"] = hm(row["closingTime"])
    days = {d: {p: v for p, v in ps.items() if "open" in v} for d, ps in days.items()}
    days = {d: ps for d, ps in days.items() if ps}
    found = sum(len(v) for v in days.values())
    if found == 0:
        print(json.dumps({"ok": True, "found": 0, "written": False, "note": "旅行の日の営業時間はまだ公開されていない"}, ensure_ascii=False))
        return
    old = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f).get("days", {})
    feed = {
        "source": {"name": "ディズニー公式の営業時間（ThemeParks.wiki 経由）", "url": "https://disneyworld.disney.go.com/calendars/"},
        "fetchedAt": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d"),
        "days": days,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(feed, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps({"ok": True, "found": found, "written": True, "changed": old != days}, ensure_ascii=False))


if __name__ == "__main__":
    main()
