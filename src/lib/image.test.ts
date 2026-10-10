import { describe, expect, it } from "vitest";
import { fitWidth } from "./image";

describe("バナー写真の縮小", () => {
  it("横幅1290pxを超える写真だけ、縦横比を保って縮める", () => {
    expect(fitWidth(2580, 1800)).toEqual({ width: 1290, height: 900 });
    expect(fitWidth(1232, 864)).toEqual({ width: 1232, height: 864 });
  });
});
