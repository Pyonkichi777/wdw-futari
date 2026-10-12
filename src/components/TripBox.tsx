import { ITINERARY, TRIP, shortDate } from "../data/trip";
import { bookingOpensJst, lightningLaneOpensJst } from "../lib/dining";

/** 旅の予定（どの画面でも上に出す。日ごとの計画の土台） */
export function TripBox() {
  const parkFirst = TRIP.parkDays[0];
  const parkLast = TRIP.parkDays[TRIP.parkDays.length - 1];
  return (
    <details className="trip-box">
      <summary>
        <span className="trip-title">📅 旅の予定</span>
        <span className="trip-sum">
          パーク {parkFirst && shortDate(parkFirst)}〜{parkLast && shortDate(parkLast)}（{TRIP.parkDays.length}日間）・宿 4/29 空港近く → {shortDate(TRIP.checkIn)}〜 ポップセンチュリー
        </span>
      </summary>
      <table className="trip-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>予定</th>
            <th>泊まる場所</th>
          </tr>
        </thead>
        <tbody>
          {ITINERARY.map((d) => (
            <tr key={d.date} className={d.park ? "park-day" : undefined}>
              <td className="trip-date">{d.date}</td>
              <td>
                {d.park && <span className="trip-park">🎢 </span>}
                {d.plan}
              </td>
              <td>{d.stay ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="access trip-deadlines">
        <div className="strong">
          <dt>レストラン予約の開始</dt>
          <dd>{bookingOpensJst(TRIP.checkIn)}（日本時間）</dd>
        </div>
        <div className="strong">
          <dt>時短パス予約の開始</dt>
          <dd>{lightningLaneOpensJst(TRIP.checkIn)}（日本時間）。滞在中の全日分をまとめて取れる</dd>
        </div>
      </dl>
      <p className="note">どちらもポップセンチュリーのチェックイン日（{shortDate(TRIP.checkIn)}）から数えた日時。仕組みは出発前に公式で再確認します。</p>
    </details>
  );
}
