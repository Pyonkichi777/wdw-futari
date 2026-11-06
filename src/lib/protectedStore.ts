import { protectWrite } from "./reloadSafety";
import type { Store } from "./store";

/** 保存中は更新ボタンと通常の再読込から保護する。失敗は呼び出し元へ返す */
export function protectedStore(store: Store): Store {
  return {
    ...store,
    setVote: (...args) => protectWrite(() => store.setVote(...args)),
    setVotes: (...args) => protectWrite(() => store.setVotes(...args)),
    setMeals: (...args) => protectWrite(() => store.setMeals(...args)),
    saveConsensus: (...args) => protectWrite(() => store.saveConsensus(...args)),
    updatePlan: (...args) => protectWrite(() => store.updatePlan(...args)),
    setCheck: (...args) => protectWrite(() => store.setCheck(...args)),
    setGotTime: (...args) => protectWrite(() => store.setGotTime(...args)),
    saveSnapshot: (...args) => protectWrite(() => store.saveSnapshot(...args)),
    deleteSnapshot: (...args) => protectWrite(() => store.deleteSnapshot(...args)),
    saveBanner: (...args) => protectWrite(() => store.saveBanner(...args)),
  };
}
