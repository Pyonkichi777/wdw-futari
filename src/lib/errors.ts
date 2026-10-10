/** Firebase のエラーを、画面に出せる日本語にする */
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "メールアドレスかパスワードが違います。",
  "auth/wrong-password": "メールアドレスかパスワードが違います。",
  "auth/user-not-found": "このメールアドレスは登録されていません。「はじめての方（登録）」から登録してください。",
  "auth/email-already-in-use": "このメールアドレスは登録済みです。「ログイン」から入ってください。",
  "auth/weak-password": "パスワードが短すぎます。8文字以上にしてください。",
  "auth/invalid-email": "メールアドレスの形式が正しくありません。",
  "auth/too-many-requests": "失敗が続いたため、しばらく待ってからやり直してください。",
  "auth/network-request-failed": "通信できませんでした。電波の良い場所でやり直してください。",
  "auth/popup-closed-by-user": "ログインの画面が閉じられました。もう一度押してください。",
  "auth/popup-blocked": "ログインの画面が開けませんでした。Safariの設定で「ポップアップブロック」をオフにするか、もう一度押してください。",
  "auth/unauthorized-domain": "このURLからのログインが許可されていません（Firebaseの「承認済みドメイン」の設定が必要です）。",
  "permission-denied": "このアカウントでは使えません。登録された2人のアカウントで入ってください。",
};

export function errorCode(e: unknown): string | null {
  if (typeof e === "object" && e !== null && "code" in e && typeof e.code === "string") return e.code;
  return null;
}

export function authErrorMessage(e: unknown): string {
  const code = errorCode(e);
  return (code && MESSAGES[code]) ?? `うまくいきませんでした（${code ?? "不明なエラー"}）。時間をおいてやり直してください。`;
}
