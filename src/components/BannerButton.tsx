import { useRef, useState } from "react";
import { fileToBannerDataUrl } from "../lib/image";

interface Props {
  hasPhoto: boolean;
  onSave: (dataUrl: string | null) => Promise<void>;
}

/** バナー写真の変更（写真を選ぶ／夜空に戻す） */
export function BannerButton({ hasPhoto, onSave }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(await fileToBannerDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "写真を保存できませんでした");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="banner-btns">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      <button className="glass" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "保存中…" : "📷 写真"}
      </button>
      {hasPhoto && (
        <button
          className="glass"
          disabled={busy}
          onClick={() => {
            if (window.confirm("バナーの写真を外して、夜空のデザインに戻しますか？")) void onSave(null);
          }}
        >
          🌙 夜空
        </button>
      )}
      {error && <span className="banner-err">{error}</span>}
    </div>
  );
}
