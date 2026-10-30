import { beforeEach, describe, expect, it, vi } from "vitest";
import { onSnapshot, runTransaction, setDoc } from "firebase/firestore";
import { createFirestoreStore, type FirebaseBackend } from "./firebaseStore";
import { emptyPlan } from "./plan";

vi.mock("firebase/firestore", async (original) => ({
  ...await original<typeof import("firebase/firestore")>(),
  doc: vi.fn(() => ({})), onSnapshot: vi.fn(), runTransaction: vi.fn(), setDoc: vi.fn(),
}));

describe("T03: Firestoreの保存経路（テスト用の通信代替）", () => {
  const fb = {} as FirebaseBackend;
  beforeEach(() => vi.resetAllMocks());
  it("通信失敗を返し、端末の古い作戦をsetDocで送信待ちにしない", async () => {
    const error = Object.assign(new Error("offline"), { code: "unavailable" });
    vi.mocked(runTransaction).mockRejectedValue(error);
    const store = createFirestoreStore(fb);
    await expect(store.updatePlan(() => emptyPlan())).rejects.toBe(error);
    expect(setDoc).not.toHaveBeenCalled();
  });
  it("表示後に相手が変更した場合は、復元を含めトランザクションで書き込まない", async () => {
    const store = createFirestoreStore(fb);
    const before = { ...emptyPlan(), updatedAt: 1 };
    vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
      const callback = args[2] as (snap: unknown) => void;
      callback({ data: () => before, metadata: { hasPendingWrites: false, fromCache: false } });
      return () => undefined;
    });
    store.subscribePlan(() => undefined);
    const write = vi.fn();
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ data: () => ({ ...before, updatedAt: 2 }) }), set: write } as unknown as Parameters<typeof callback>[0]));
    await expect(store.updatePlan(() => emptyPlan())).rejects.toMatchObject({ code: "plan/conflict" });
    expect(write).not.toHaveBeenCalled();
  });
  it("予約チェックの解除は取得枠を削除するパッチを送らない", async () => {
    await createFirestoreStore(fb).setCheck("mp:test", false, "toshi");
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), { done: { "mp:test": { by: "toshi", at: expect.any(Number), done: false } } }, { merge: true });
  });
  it("入力中に相手が同じ予約枠を変えたら、取得枠を上書きしない", async () => {
    const write = vi.fn();
    const current = { "mp:test": { by: "tsuma", at: 1, got: { ride: { from: "13:00", to: "14:00" } } } };
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ data: () => ({ done: current }) }), set: write } as unknown as Parameters<typeof callback>[0]));
    await expect(createFirestoreStore(fb).setGotTime("mp:test", "ride", { from: "12:00", to: "12:45" }, "toshi", null)).rejects.toMatchObject({ code: "booking/conflict" });
    expect(write).not.toHaveBeenCalled();
  });
});
