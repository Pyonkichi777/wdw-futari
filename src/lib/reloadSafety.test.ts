import { expect, it } from "vitest";
import { blockReload, protectWrite, reloadBlocked } from "./reloadSafety";

it("R03: 複数の下書き・保存がすべて終わるまで再読込を止め、失敗時も解除する", async () => {
  const a = blockReload();
  const b = blockReload();
  a();
  expect(reloadBlocked()).toBe(true);
  b();
  expect(reloadBlocked()).toBe(false);
  await expect(protectWrite(async () => { expect(reloadBlocked()).toBe(true); throw new Error("save failed"); })).rejects.toThrow("save failed");
  expect(reloadBlocked()).toBe(false);
});
