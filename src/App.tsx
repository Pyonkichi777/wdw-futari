import type { PlanSnapshot } from "./lib/snapshots";
import { fetchHoursFeed, type HoursFeed } from "./lib/hours";
import { fetchCrowdFeed, type CrowdFeed } from "./lib/crowd";
import { useEffect, useMemo, useState } from "react";
import { ConsensusScreen } from "./components/ConsensusScreen";
import { BannerButton } from "./components/BannerButton";
import { Countdown } from "./components/Countdown";
import { TitleLockup } from "./components/TitleLockup";
import { TripBox } from "./components/TripBox";
import { ScrollTopButton, scrollToTop } from "./components/ScrollTopButton";
import { Skyline } from "./components/Skyline";
import { DiningScreen } from "./components/DiningScreen";
import { PlanScreen } from "./components/PlanScreen";
import { emptyPlan, type Plan } from "./lib/plan";
import type { Checks } from "./lib/checks";
import { Encyclopedia } from "./components/Encyclopedia";
import { NewsProvider, useNews } from "./components/NewsContext";
import { NewsScreen } from "./components/NewsScreen";
import { LoginScreen } from "./components/LoginScreen";
import { VoteScreen } from "./components/VoteScreen";
import type { RideFocus } from "./components/useRideFocus";
import { firebaseConfig } from "./firebaseConfig";
import { emptyConsensus, emptyVotes, type AllVotes } from "./lib/consensus";
import { emptyMeals, type AllMeals } from "./lib/meals";
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

type Tab = "zukan" | "vote" | "dining" | "consensus" | "plan" | "news";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "zukan", label: "図鑑", icon: "🏰" },
  { id: "vote", label: "投票", icon: "⭐" },
  { id: "dining", label: "食事", icon: "🍽" },
  { id: "consensus", label: "合意", icon: "💖" },
  { id: "plan", label: "作戦", icon: "🗺" },
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
  const [meals, setMeals] = useState<AllMeals>(emptyMeals);
  useEffect(() => store.subscribeMeals(setMeals), [store]);
  const [checks, setChecks] = useState<Checks>({});
  useEffect(() => store.subscribeChecks(setChecks), [store]);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [planPending, setPlanPending] = useState(false);
  useEffect(
    () =>
      store.subscribePlan((p, pending) => {
        setPlan(p);
        setPlanPending(pending);
      }),
    [store],
  );
  // 混雑予想サイトから取り込んだ値（public/crowd.json。まだ無ければ一般的な傾向から推定）
  const [crowd, setCrowd] = useState<CrowdFeed | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCrowdFeed().then(
      (f) => alive && setCrowd(f),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  // 公式の営業時間（public/hours.json。公開されるまでは開園9:00と仮定）
  const [hours, setHours] = useState<HoursFeed | null>(null);
  useEffect(() => {
    let alive = true;
    fetchHoursFeed().then(
      (f) => alive && setHours(f),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>([]);
  useEffect(() => store.subscribeSnapshots(setSnapshots), [store]);
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => store.subscribeBanner(setPhoto), [store]);

  const report = (e: unknown): void => setError(authErrorMessage(e));

  // 図鑑⇔投票のリンク：タブを切り替えて、そのアトラクションのカードまで飛ぶ
  const [focus, setFocus] = useState<RideFocus | null>(null);
  const jumpTo = (next: Tab, rideId: string): void => {
    setTab(next);
    setFocus((f) => ({ rideId, seq: (f?.seq ?? 0) + 1 }));
  };
  const switchTab = (next: Tab): void => {
    // 今いるタブをもう一度押したら一番上へ戻る
    if (next === tab) scrollToTop();
    setTab(next);
    setFocus(null);
    setBack(null);
  };

  // 作戦 → 図鑑 へ飛んだときの「戻る」先（作戦のどの項目から来たか）
  const [back, setBack] = useState<{ tab: Tab; anchor: string } | null>(null);
  const [restore, setRestore] = useState<string | null>(null);
  const goZukanFrom = (from: Tab, rideId: string, anchor: string): void => {
    setBack({ tab: from, anchor });
    jumpTo("zukan", rideId);
  };
  const goBack = (): void => {
    if (!back) return;
    setTab(back.tab);
    setFocus(null);
    setRestore(back.anchor);
    setBack(null);
  };
  useEffect(() => {
    if (!restore) return;
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById(restore);
      setRestore(null);
      if (!el) return;
      // 折りたたみの中なら開いてから
      for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
      el.scrollIntoView({ behavior: "instant", block: "center" });
      el.classList.add("flash");
      window.setTimeout(() => el.classList.remove("flash"), 2000);
    });
    return () => window.cancelAnimationFrame(id);
  }, [restore, tab]);

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
      <TripBox />
      {banner && <p className="banner demo">{banner}</p>}
      {error && (
        <p className="banner warn" onClick={() => setError(null)}>
          {error}
        </p>
      )}
      <main className="content">
        {tab === "zukan" && <Encyclopedia myVotes={votes[me]} focus={focus} onGoVote={(id) => jumpTo("vote", id)} />}
        {tab === "zukan" && back && (
          <button className="back-button" onClick={goBack}>
            ← 作戦に戻る
          </button>
        )}
        {tab === "vote" && (
          <VoteScreen
            me={me}
            votes={votes}
            onVote={(id, lv) => store.setVote(me, id, lv).catch(report)}
            onBulkVote={(ids, lv) => store.setVotes(me, ids, lv).catch(report)}
            focus={focus}
            onGoZukan={(id) => jumpTo("zukan", id)}
            meals={meals}
            onMeals={(id, m) => store.setMeals(me, id, m).catch(report)}
          />
        )}
        {tab === "dining" && <DiningScreen myVotes={votes[me]} onGoVote={(id) => jumpTo("vote", id)} />}
        {tab === "plan" && (
          <PlanScreen
            me={me}
            consensus={consensus}
            plan={plan}
            onUpdate={(change) => store.updatePlan(change).catch(report)}
            pending={planPending}
            votes={votes}
            checks={checks}
            onCheck={(id, done) => store.setCheck(id, done, me).catch(report)}
            onZukan={(id, anchor) => goZukanFrom("plan", id, anchor)}
            crowd={crowd}
            hours={hours}
            snapshots={snapshots}
            onSaveSnapshot={(snap, replace) => store.saveSnapshot(snap, replace)}
            onDeleteSnapshot={(id) => store.deleteSnapshot(id, me).catch(report)}
          />
        )}
        {tab === "news" && <NewsScreen plan={plan} hours={hours} />}
        {tab === "consensus" && <ConsensusScreen me={me} votes={votes} meals={meals} consensus={consensus} onSave={(c) => store.saveConsensus(c).catch(report)} />}
      </main>
      <ScrollTopButton />
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab on" : "tab"} onClick={() => switchTab(t.id)} aria-current={tab === t.id ? "page" : undefined}>
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
