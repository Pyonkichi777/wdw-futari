import { useEffect, useMemo, useState } from "react";
import { ConsensusScreen } from "./components/ConsensusScreen";
import { BannerButton } from "./components/BannerButton";
import { Countdown } from "./components/Countdown";
import { TitleLockup } from "./components/TitleLockup";
import { Skyline } from "./components/Skyline";
import { Encyclopedia } from "./components/Encyclopedia";
import { NewsProvider, useNews } from "./components/NewsContext";
import { NewsScreen } from "./components/NewsScreen";
import { LoginScreen } from "./components/LoginScreen";
import { VoteScreen } from "./components/VoteScreen";
import { firebaseConfig } from "./firebaseConfig";
import { emptyConsensus, emptyVotes, type AllVotes } from "./lib/consensus";
import { authErrorMessage } from "./lib/errors";
import {
  createFirestoreStore,
  initFirebase,
  loadProfile,
  logout,
  refreshUser,
  resendVerification,
  saveProfile,
  watchAuth,
  type FirebaseBackend,
} from "./lib/firebaseStore";
import { createLocalStore } from "./lib/localStore";
import { PERSON_LABEL, type AuthUser, type Store } from "./lib/store";
import type { Consensus, PersonId } from "./types";

type Tab = "zukan" | "vote" | "consensus" | "news";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "zukan", label: "図鑑", icon: "🏰" },
  { id: "vote", label: "投票", icon: "⭐" },
  { id: "consensus", label: "合意リスト", icon: "💖" },
  { id: "news", label: "ニュース", icon: "📰" },
];

const DEMO_PERSON_KEY = "wdw-futari:demo:person";

const fb: FirebaseBackend | null = firebaseConfig ? initFirebase(firebaseConfig) : null;

export function App() {
  return <NewsProvider>{fb ? <FirebaseGate fb={fb} /> : <DemoGate />}</NewsProvider>;
}

/** Firebase の設定がまだ無いときの「お試しモード」。データはこの端末にだけ保存される */
function DemoGate() {
  const store = useMemo(createLocalStore, []);
  const [person, setPerson] = useState<PersonId | null>(() => {
    try {
      const p = localStorage.getItem(DEMO_PERSON_KEY);
      return p === "toshi" || p === "tsuma" ? p : null;
    } catch {
      return null;
    }
  });
  const choose = (p: PersonId | null): void => {
    setPerson(p);
    try {
      if (p) localStorage.setItem(DEMO_PERSON_KEY, p);
      else localStorage.removeItem(DEMO_PERSON_KEY);
    } catch {
      // 保存できなくても画面上は切り替わる
    }
  };
  if (!person) return <PersonPicker onPick={choose} demo />;
  return (
    <Main
      me={person}
      store={store}
      banner="お試しモード：データはこの端末にだけ保存されます（2人の同期はFirebase設定後）"
      onSwitch={() => choose(null)}
      switchLabel="人を切り替える"
    />
  );
}

function FirebaseGate({ fb }: { fb: FirebaseBackend }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [person, setPerson] = useState<PersonId | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const store = useMemo(() => createFirestoreStore(fb), [fb]);

  useEffect(() => watchAuth(fb, setUser), [fb]);

  useEffect(() => {
    setPerson(undefined);
    setError(null);
    if (!user?.verified) return;
    loadProfile(fb, user.uid).then(setPerson, (e: unknown) => setError(authErrorMessage(e)));
  }, [fb, user]);

  if (user === undefined) return <Splash text="読み込み中…" />;
  if (user === null) return <LoginScreen fb={fb} />;
  if (!user.verified) return <VerifyEmail fb={fb} user={user} onRefreshed={setUser} />;
  if (error) return <ErrorScreen message={error} onLogout={() => void logout(fb)} />;
  if (person === undefined) return <Splash text="読み込み中…" />;
  if (person === null)
    return (
      <PersonPicker
        onPick={(p) => {
          if (!p) return;
          saveProfile(fb, user.uid, p).then(() => setPerson(p), (e: unknown) => setError(authErrorMessage(e)));
        }}
      />
    );
  return <Main me={person} store={store} onSwitch={() => void logout(fb)} switchLabel="ログアウト" />;
}

function Main({ me, store, banner, onSwitch, switchLabel }: { me: PersonId; store: Store; banner?: string; onSwitch: () => void; switchLabel: string }) {
  const [tab, setTab] = useState<Tab>("vote");
  const [votes, setVotes] = useState<AllVotes>(emptyVotes);
  const [consensus, setConsensus] = useState<Consensus>(emptyConsensus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => store.subscribeVotes(setVotes), [store]);
  useEffect(() => store.subscribeConsensus(setConsensus), [store]);
  const { unseen: urgent } = useNews();
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => store.subscribeBanner(setPhoto), [store]);

  const report = (e: unknown): void => setError(authErrorMessage(e));

  return (
    <div className="app">
      <header
        className={photo ? "top sky has-photo" : "top sky"}
        style={photo ? { backgroundImage: `linear-gradient(160deg, rgba(20, 12, 50, 0.85) 0%, rgba(20, 12, 50, 0.55) 40%, rgba(20, 12, 50, 0.1) 72%), url(${photo})` } : undefined}
      >
        <div className="top-text">
          <TitleLockup />
          <Countdown />
          <p className="sub">{PERSON_LABEL[me]}として使用中</p>
        </div>
        <button className="link" onClick={onSwitch}>
          {switchLabel}
        </button>
        {!photo && <Skyline />}
        <BannerButton hasPhoto={photo !== null} onSave={(d) => store.saveBanner(d).catch(report)} />
      </header>
      {banner && <p className="banner demo">{banner}</p>}
      {error && (
        <p className="banner warn" onClick={() => setError(null)}>
          {error}
        </p>
      )}
      <main className="content">
        {tab === "zukan" && <Encyclopedia />}
        {tab === "vote" && (
          <VoteScreen
            me={me}
            votes={votes}
            onVote={(id, lv) => store.setVote(me, id, lv).catch(report)}
            onBulkVote={(ids, lv) => store.setVotes(me, ids, lv).catch(report)}
          />
        )}
        {tab === "news" && <NewsScreen />}
        {tab === "consensus" && <ConsensusScreen me={me} votes={votes} consensus={consensus} onSave={(c) => store.saveConsensus(c).catch(report)} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab on" : "tab"} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}>
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
            {t.id === "news" && urgent > 0 && <span className="tab-badge">{urgent}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function PersonPicker({ onPick, demo = false }: { onPick: (p: PersonId | null) => void; demo?: boolean }) {
  return (
    <main className="login sky-page">
      <h1>ぞうたんフロリダ上陸ツアー</h1>
      <p className="lead">{demo ? "お試しモード：どちらとして使いますか？" : "はじめに、あなたはどちらですか？（あとから変更はできません）"}</p>
      <div className="picker">
        {(["toshi", "tsuma"] as const).map((p) => (
          <button key={p} className="primary wide" onClick={() => onPick(p)}>
            {PERSON_LABEL[p]}
          </button>
        ))}
      </div>
    </main>
  );
}

function VerifyEmail({ fb, user, onRefreshed }: { fb: FirebaseBackend; user: AuthUser; onRefreshed: (u: AuthUser | null) => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <main className="login sky-page">
      <h1>確認メールを送りました</h1>
      <p className="lead">
        {user.email} に届いたメールのリンクを押してから、下のボタンを押してください。迷惑メールのフォルダに入っていることがあります。
      </p>
      <div className="picker">
        <button
          className="primary wide"
          onClick={() =>
            refreshUser(fb).then(
              (u) => {
                onRefreshed(u);
                if (!u?.verified) setMsg("まだ確認が済んでいません。メールのリンクを押してから、もう一度押してください。");
              },
              (e: unknown) => setMsg(authErrorMessage(e)),
            )
          }
        >
          リンクを押した
        </button>
        <button onClick={() => resendVerification(fb).then(() => setMsg("確認メールをもう一度送りました。"), (e: unknown) => setMsg(authErrorMessage(e)))}>
          確認メールをもう一度送る
        </button>
        <button className="link" onClick={() => void logout(fb)}>
          ログアウト
        </button>
      </div>
      {msg && <p className="banner warn">{msg}</p>}
    </main>
  );
}

function ErrorScreen({ message, onLogout }: { message: string; onLogout: () => void }) {
  return (
    <main className="login sky-page">
      <h1>ぞうたんフロリダ上陸ツアー</h1>
      <p className="banner warn">{message}</p>
      <button className="link" onClick={onLogout}>
        ログアウト
      </button>
    </main>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <main className="login sky-page">
      <p className="lead">{text}</p>
    </main>
  );
}
