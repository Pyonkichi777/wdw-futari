/** フロリダ上陸（日本出発 2027-04-29）までのカウントダウン */
const DEPART = Date.UTC(2027, 3, 28, 15); // 2027-04-29 00:00 日本時間

export function daysUntilDeparture(now: number = Date.now()): number {
  return Math.ceil((DEPART - now) / 86_400_000);
}

export function Countdown() {
  const days = daysUntilDeparture();
  if (days > 0) {
    return (
      <p className="countdown">
        フロリダ上陸まで あと<strong>{days}</strong>日
      </p>
    );
  }
  return <p className="countdown">ようこそフロリダへ！ 楽しい旅を ✨</p>;
}
