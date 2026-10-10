import type { FirebaseOptions } from "firebase/app";

/**
 * Firebase の設定値（Firebaseコンソール「プロジェクトの設定」→「マイアプリ」に表示されるもの）。
 * この値は秘密情報ではない（ウェブアプリに埋め込んで公開する前提）。守りはログインとセキュリティルールで行う。
 * null の間は「お試しモード」で動く（データはこの端末のブラウザにだけ保存される）。
 */
export const firebaseConfig: FirebaseOptions | null = null;
