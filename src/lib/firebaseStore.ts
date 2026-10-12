import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { deleteDoc, deleteField, doc, getDoc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, setDoc, type Firestore } from "firebase/firestore";
import type { Consensus, ConsensusItem, PersonId, Rank, VoteLevel, Votes } from "../types";
import { emptyConsensus, emptyVotes, type AllVotes } from "./consensus";
import { emptyMeals, parseMealPrefs, type AllMeals } from "./meals";
import { parsePlan } from "./plan";
import { parseChecks } from "./checks";
import type { AuthUser, Store } from "./store";

export interface FirebaseBackend {
  auth: Auth;
  db: Firestore;
}

export function initFirebase(config: FirebaseOptions): FirebaseBackend {
  const app = initializeApp(config);
  // 端末内に保存しておき、電波がない場所でも読み書きできる（つながったら自動で同期）
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  return { auth: getAuth(app), db };
}

const toAuthUser = (u: User): AuthUser => {
  const google = u.providerData.some((p) => p.providerId === "google.com");
  return { uid: u.uid, email: u.email, verified: google || u.emailVerified, provider: google ? "google" : "password" };
};

export const watchAuth = (fb: FirebaseBackend, cb: (u: AuthUser | null) => void): (() => void) =>
  onAuthStateChanged(fb.auth, (u) => cb(u ? toAuthUser(u) : null));

export async function loginWithGoogle(fb: FirebaseBackend): Promise<void> {
  await signInWithPopup(fb.auth, new GoogleAuthProvider());
}

export async function loginWithEmail(fb: FirebaseBackend, email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(fb.auth, email, password);
}

export async function registerWithEmail(fb: FirebaseBackend, email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
  await sendEmailVerification(cred.user);
}

export async function resendVerification(fb: FirebaseBackend): Promise<void> {
  if (fb.auth.currentUser) await sendEmailVerification(fb.auth.currentUser);
}

/** 確認メールのリンクを押したあと、最新の状態を取り直す */
export async function refreshUser(fb: FirebaseBackend): Promise<AuthUser | null> {
  const u = fb.auth.currentUser;
  if (!u) return null;
  await reload(u);
  await u.getIdToken(true); // セキュリティルールに「確認済み」を反映させる
  return toAuthUser(u);
}

export const resetPassword = (fb: FirebaseBackend, email: string): Promise<void> => sendPasswordResetEmail(fb.auth, email);

export const logout = (fb: FirebaseBackend): Promise<void> => signOut(fb.auth);

/** ログインした人が「Toshi」と「妻」のどちらか。初回に本人が選ぶ */
export async function loadProfile(fb: FirebaseBackend, uid: string): Promise<PersonId | null> {
  const snap = await getDoc(doc(fb.db, "profiles", uid));
  const person: unknown = snap.data()?.person;
  return person === "toshi" || person === "tsuma" ? person : null;
}

export const saveProfile = (fb: FirebaseBackend, uid: string, person: PersonId): Promise<void> =>
  setDoc(doc(fb.db, "profiles", uid), { person });

const isVoteLevel = (v: unknown): v is VoteLevel => v === "must" || v === "want" || v === "either" || v === "skip";

function parseVotes(data: unknown): Votes {
  const out: Votes = {};
  if (typeof data !== "object" || data === null) return out;
  for (const [k, v] of Object.entries(data)) if (isVoteLevel(v)) out[k] = v;
  return out;
}

const isRank = (v: unknown): v is Rank => v === "S" || v === "A" || v === "B";

function parseConsensus(data: unknown): Consensus {
  if (typeof data !== "object" || data === null) return emptyConsensus();
  const d = data as Record<string, unknown>;
  const items = Array.isArray(d.items)
    ? d.items.flatMap((it: unknown): ConsensusItem[] => {
        if (typeof it !== "object" || it === null) return [];
        const { rideId, rank, meal } = it as Record<string, unknown>;
        if (typeof rideId !== "string" || !isRank(rank)) return [];
        return [meal === "breakfast" || meal === "lunch" || meal === "dinner" ? { rideId, rank, meal } : { rideId, rank }];
      })
    : [];
  const updatedBy = d.updatedBy === "toshi" || d.updatedBy === "tsuma" ? d.updatedBy : null;
  return {
    items,
    confirmed: d.confirmed === true,
    updatedBy,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : null,
  };
}

export function createFirestoreStore(fb: FirebaseBackend): Store {
  return {
    subscribeVotes(cb) {
      let all: AllVotes = emptyVotes();
      const unsubs = (["toshi", "tsuma"] as const).map((p) =>
        onSnapshot(doc(fb.db, "votes", p), (snap) => {
          all = { ...all, [p]: parseVotes(snap.data()?.votes) };
          cb(all);
        }),
      );
      return () => unsubs.forEach((u) => u());
    },
    async setVote(person, rideId, level) {
      await setDoc(doc(fb.db, "votes", person), { votes: { [rideId]: level } }, { merge: true });
    },
    async setVotes(person, rideIds, level) {
      const patch: Record<string, VoteLevel> = {};
      for (const id of rideIds) patch[id] = level;
      await setDoc(doc(fb.db, "votes", person), { votes: patch }, { merge: true });
    },
    subscribeMeals(cb) {
      let all: AllMeals = emptyMeals();
      const unsubs = (["toshi", "tsuma"] as const).map((p) =>
        onSnapshot(doc(fb.db, "votes", p), (snap) => {
          all = { ...all, [p]: parseMealPrefs(snap.data()?.meals) };
          cb(all);
        }),
      );
      return () => unsubs.forEach((u) => u());
    },
    async setMeals(person, rideId, meals) {
      await setDoc(doc(fb.db, "votes", person), { meals: { [rideId]: [...meals] } }, { merge: true });
    },
    subscribeConsensus(cb) {
      return onSnapshot(doc(fb.db, "consensus", "main"), (snap) => cb(parseConsensus(snap.data())));
    },
    async saveConsensus(c) {
      await setDoc(doc(fb.db, "consensus", "main"), c);
    },
    // 作戦は合意リストと同じ consensus コレクションに置く（セキュリティルールの追加が要らない）
    subscribePlan(cb) {
      return onSnapshot(doc(fb.db, "consensus", "plan"), (snap) => cb(parsePlan(snap.data())));
    },
    async savePlan(p) {
      await setDoc(doc(fb.db, "consensus", "plan"), JSON.parse(JSON.stringify(p)) as Record<string, unknown>);
    },
    subscribeChecks(cb) {
      return onSnapshot(doc(fb.db, "consensus", "checks"), (snap) => cb(parseChecks(snap.data()?.done)));
    },
    async setCheck(id, done, by) {
      await setDoc(doc(fb.db, "consensus", "checks"), { done: { [id]: done ? { by, at: Date.now() } : deleteField() } }, { merge: true });
    },
    subscribeBanner(cb) {
      return onSnapshot(
        doc(fb.db, "assets", "banner"),
        (snap) => {
          const v: unknown = snap.data()?.dataUrl;
          cb(typeof v === "string" && v.startsWith("data:image/") ? v : null);
        },
        // ルール未設定などで読めないときは、写真なし（夜空）で表示する
        () => cb(null),
      );
    },
    async saveBanner(dataUrl) {
      const ref = doc(fb.db, "assets", "banner");
      if (dataUrl === null) await deleteDoc(ref);
      else await setDoc(ref, { dataUrl, updatedAt: Date.now() });
    },
  };
}
