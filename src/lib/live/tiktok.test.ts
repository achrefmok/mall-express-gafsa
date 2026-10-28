import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkTiktokLiveUrl,
  firstTiktokUrl,
  isTiktokUrl,
  resolveTiktokLiveUrl,
  tiktokAccount,
} from "./tiktok";

const LIVE = "https://www.tiktok.com/@boutique.gafsa/live";

describe("checkTiktokLiveUrl", () => {
  it.each([
    ["https://www.tiktok.com/@boutique.gafsa/live"],
    ["https://www.tiktok.com/@boutique.gafsa"],
    ["https://www.tiktok.com/@boutique.gafsa/"],
    ["https://tiktok.com/@boutique.gafsa/live?is_from_webapp=1&sender_device=pc"],
    ["https://m.tiktok.com/@boutique.gafsa/live"],
    ["https://www.tiktok.com/@boutique.gafsa/video/7301234567890123456"],
    ["  https://www.tiktok.com/@boutique.gafsa/live  "],
  ])("ramène %s au lien du direct", (input) => {
    expect(checkTiktokLiveUrl(input)).toEqual({ ok: true, url: LIVE });
  });

  it("garde un lien court, sans son suivi, pour le déplier ensuite", () => {
    expect(checkTiktokLiveUrl("https://vm.tiktok.com/ZSabc123/?_r=1")).toEqual({
      ok: true,
      url: "https://vm.tiktok.com/ZSabc123/",
    });
  });

  it.each([
    ["pas un lien"],
    ["http://www.tiktok.com/@boutique.gafsa/live"],
    ["https://www.facebook.com/page/videos/123"],
    ["https://www.tiktok.com/live"],
    ["https://www.tiktok.com/"],
    ["https://vm.tiktok.com/"],
    ["https://tiktok.com.evil.example/@boutique/live"],
  ])("refuse %s", (input) => {
    expect(checkTiktokLiveUrl(input).ok).toBe(false);
  });
});

describe("resolveTiktokLiveUrl", () => {
  afterEach(() => vi.unstubAllGlobals());

  const redirectTo = (location: string | null) =>
    vi.fn().mockResolvedValue(new Response(null, { status: 301, headers: location ? { location } : {} }));

  it("déplie un lien court jusqu'au compte", async () => {
    vi.stubGlobal("fetch", redirectTo("https://www.tiktok.com/@boutique.gafsa/live?_t=8abc&_r=1"));
    expect(await resolveTiktokLiveUrl("https://vm.tiktok.com/ZSabc123/")).toEqual({ ok: true, url: LIVE });
  });

  it("refuse un lien court que TikTok ne redirige pas", async () => {
    vi.stubGlobal("fetch", redirectTo(null));
    expect((await resolveTiktokLiveUrl("https://vm.tiktok.com/ZSabc123/")).ok).toBe(false);
  });

  it("refuse un lien court quand TikTok est injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")));
    expect((await resolveTiktokLiveUrl("https://vm.tiktok.com/ZSabc123/")).ok).toBe(false);
  });

  it("ne sollicite pas le réseau pour un lien complet", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await resolveTiktokLiveUrl(LIVE)).toEqual({ ok: true, url: LIVE });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("firstTiktokUrl / isTiktokUrl / tiktokAccount", () => {
  it("extrait l'adresse du texte partagé", () => {
    expect(firstTiktokUrl("Regardez le LIVE de Boutique sur TikTok ! https://vm.tiktok.com/ZSabc123/ 🎉")).toBe(
      "https://vm.tiktok.com/ZSabc123/",
    );
    expect(firstTiktokUrl("rien ici")).toBeNull();
    expect(firstTiktokUrl(undefined)).toBeNull();
  });

  it("reconnaît les hôtes TikTok, et eux seuls", () => {
    expect(isTiktokUrl(LIVE)).toBe(true);
    expect(isTiktokUrl("https://vt.tiktok.com/ZSabc/")).toBe(true);
    expect(isTiktokUrl("https://www.facebook.com/page/videos/1")).toBe(false);
    expect(isTiktokUrl("n'importe quoi")).toBe(false);
  });

  it("lit le compte", () => {
    expect(tiktokAccount(LIVE)).toBe("boutique.gafsa");
    expect(tiktokAccount("https://vm.tiktok.com/ZSabc/")).toBeNull();
  });
});
