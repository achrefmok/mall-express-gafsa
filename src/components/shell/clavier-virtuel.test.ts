import { describe, expect, it } from "vitest";
import { mesurerRecouvrement } from "./clavier-virtuel";

describe("mesurerRecouvrement", () => {
  it("Safari iOS : la fenêtre visuelle rétrécit, la page non", () => {
    expect(mesurerRecouvrement({ innerHeight: 844, vvHeight: 508, vvOffsetTop: 0, vvScale: 1 })).toBe(336);
  });

  it("iOS a fait défiler la fenêtre visuelle pour montrer le champ", () => {
    expect(mesurerRecouvrement({ innerHeight: 844, vvHeight: 508, vvOffsetTop: 120, vvScale: 1 })).toBe(216);
  });

  it("Chrome Android (resizes-content) : la page a déjà rétréci, rien n'est recouvert", () => {
    expect(mesurerRecouvrement({ innerHeight: 509, vvHeight: 509, vvOffsetTop: 0, vvScale: 1 })).toBe(0);
  });

  it("zoom à deux doigts : ce n'est pas un clavier", () => {
    expect(mesurerRecouvrement({ innerHeight: 844, vvHeight: 400, vvOffsetTop: 0, vvScale: 2 })).toBe(0);
  });

  it("sans visualViewport : rien à mesurer", () => {
    expect(mesurerRecouvrement({ innerHeight: 844, vvHeight: null, vvOffsetTop: 0, vvScale: 1 })).toBe(0);
  });
});
