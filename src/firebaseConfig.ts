import type { FirebaseOptions } from "firebase/app";

/**
 * Firebase の設定値（Firebaseコンソール「プロジェクトの設定」→「マイアプリ」に表示されるもの）。
 * この値は秘密情報ではない（ウェブアプリに埋め込んで公開する前提）。守りはログインとセキュリティルールで行う。
 * null にすると「お試しモード」で動く（データはこの端末のブラウザにだけ保存される）。
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: "AIzaSyA9zoksoClTz4G53GIKo1Fku50OjL1KSMk",
  authDomain: "wdw-futari.firebaseapp.com",
  projectId: "wdw-futari",
  storageBucket: "wdw-futari.firebasestorage.app",
  messagingSenderId: "450359159438",
  appId: "1:450359159438:web:505abf63f1d9418b9e37df",
};
