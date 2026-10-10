import { useState, type FormEvent } from "react";
import { authErrorMessage } from "../lib/errors";
import { Countdown } from "./Countdown";
import { Skyline } from "./Skyline";
import { TitleLockup } from "./TitleLockup";
import type { FirebaseBackend } from "../lib/firebaseStore";
import { loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } from "../lib/firebaseStore";

type Mode = "login" | "register";

export function LoginScreen({ fb }: { fb: FirebaseBackend }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, success?: string): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (success) setMessage(success);
    } catch (e) {
      setMessage(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void run(() => (mode === "login" ? loginWithEmail(fb, email.trim(), password) : registerWithEmail(fb, email.trim(), password)));
  };

  return (
    <main className="login sky-page">
      <div className="login-hero sky">
        <TitleLockup center />
        <p className="lead">2027年5月 フロリダ・ディズニーの作戦帳</p>
        <Countdown />
        <Skyline />
      </div>

      <section className="login-box">
        <h2>Googleアカウントで入る</h2>
        <button className="primary wide" disabled={busy} onClick={() => void run(() => loginWithGoogle(fb))}>
          Googleでログイン
        </button>
      </section>

      <section className="login-box">
        <h2>メールアドレスで入る</h2>
        <div className="chips">
          <button className={mode === "login" ? "chip on" : "chip"} onClick={() => setMode("login")}>
            ログイン
          </button>
          <button className={mode === "register" ? "chip on" : "chip"} onClick={() => setMode("register")}>
            はじめての方（登録）
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            メールアドレス
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            パスワード{mode === "register" && "（8文字以上）"}
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary wide" type="submit" disabled={busy}>
            {mode === "login" ? "ログイン" : "登録して確認メールを送る"}
          </button>
        </form>
        {mode === "login" && (
          <button
            className="link"
            disabled={busy || email.trim() === ""}
            onClick={() => void run(() => resetPassword(fb, email.trim()), "パスワード再設定のメールを送りました。メールのリンクから新しいパスワードを決めてください。")}
          >
            パスワードを忘れた（上にメールアドレスを入れてから押す）
          </button>
        )}
      </section>
      {message && <p className="banner warn">{message}</p>}
    </main>
  );
}
