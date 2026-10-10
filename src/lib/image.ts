/** バナー写真の大きさ（横幅の上限）と、保存できる大きさの上限 */
export const BANNER_MAX_WIDTH = 1290;
/** Firestore の1件の上限（1MB）に余裕を持たせた、data URL の文字数の上限 */
export const BANNER_MAX_CHARS = 700_000;

/** 横幅が上限を超えるときだけ縮める（縦横比は保つ） */
export function fitWidth(width: number, height: number, maxWidth: number = BANNER_MAX_WIDTH): { width: number; height: number } {
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.round((height * maxWidth) / width) };
}

/** 写真を読み込み、縮小・JPEG圧縮した data URL にする（上限に収まるまで画質を下げる） */
export async function fileToBannerDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWidth(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を処理できませんでした");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= BANNER_MAX_CHARS) return url;
  }
  throw new Error("写真が大きすぎて保存できません。小さめの写真を選んでください");
}
