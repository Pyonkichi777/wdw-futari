/** 夜空に浮かぶお城とヤシの木、上がる花火のシルエット（装飾。読み上げ対象外） */
export function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 390 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g className="fw fw-1">
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1="300" y1="22" x2={300 + 13 * Math.cos((i * Math.PI) / 5)} y2={22 + 13 * Math.sin((i * Math.PI) / 5)} />
        ))}
      </g>
      <g className="fw fw-2">
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1="92" y1="16" x2={92 + 10 * Math.cos((i * Math.PI) / 4)} y2={16 + 10 * Math.sin((i * Math.PI) / 4)} />
        ))}
      </g>
      <g className="silhouette">
        {/* ヤシの木（左） */}
        <path d="M30 90 C32 70 33 58 36 48 L38 48 C36 60 35 72 35 90 Z" />
        <path d="M37 48 C28 40 18 42 10 48 C20 42 28 44 36 50 Z M37 48 C40 38 50 34 60 38 C50 36 44 40 38 50 Z M37 48 C30 34 22 30 14 32 C24 32 30 38 36 49 Z M37 48 C46 44 54 48 58 56 C52 50 46 48 38 50 Z" />
        {/* お城 */}
        <path d="M150 90 V62 h8 v-8 l4 -10 l4 10 v8 h6 V48 l5 -14 l5 14 v-6 h4 V30 l6 -22 l6 22 v12 h4 v6 l5 -14 l5 14 v14 h6 v-8 l4 -10 l4 10 v8 h8 V90 Z" />
        <rect x="191" y="74" width="10" height="16" rx="5" className="door" />
        {/* ヤシの木（右） */}
        <path d="M338 90 C337 74 338 62 342 52 L344 52 C341 64 341 76 342 90 Z" />
        <path d="M343 52 C334 44 324 46 316 52 C326 46 334 48 342 54 Z M343 52 C348 42 358 40 368 44 C358 42 352 46 344 54 Z M343 52 C352 50 360 54 364 62 C358 56 352 54 344 54 Z" />
        <path d="M0 90 V84 Q60 78 120 84 T240 84 T390 82 V90 Z" />
      </g>
    </svg>
  );
}
