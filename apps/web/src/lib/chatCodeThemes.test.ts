import { describe, expect, it } from "vitest";

import {
  ALL_CHAT_CODE_THEME_NAMES,
  resolveChatCodeThemeName,
  DRAFT_CHAT_CODE_THEME_BACKGROUND,
  DRAFT_CHAT_CODE_THEME_NAME,
} from "./chatCodeThemes";
import { AMOLED_GITHUB_THEME_NAME } from "./amoledGithubTheme";
import { LILAC_THEME_NAME } from "./lilacTheme";

describe("resolveChatCodeThemeName", () => {
  it("uses the dedicated chat code theme for the Draft Chat preset", () => {
    expect(resolveChatCodeThemeName("dark", "draft-chat-theme")).toBe(DRAFT_CHAT_CODE_THEME_NAME);
  });

  it("falls back to the integrated diff/code themes for other presets", () => {
    expect(resolveChatCodeThemeName("dark", "github-dark")).toBe("github-dark");
    expect(resolveChatCodeThemeName("dark", "lilac")).toBe(LILAC_THEME_NAME);
    expect(resolveChatCodeThemeName("dark", "amoled-github")).toBe(AMOLED_GITHUB_THEME_NAME);
    expect(resolveChatCodeThemeName("light", null)).toBe("pierre-light");
  });
});

describe("ALL_CHAT_CODE_THEME_NAMES", () => {
  it("includes the dedicated Draft Chat code theme alongside the bundled themes", () => {
    expect(ALL_CHAT_CODE_THEME_NAMES).toContain(DRAFT_CHAT_CODE_THEME_NAME);
    expect(ALL_CHAT_CODE_THEME_NAMES).toContain(LILAC_THEME_NAME);
    expect(ALL_CHAT_CODE_THEME_NAMES).toContain(AMOLED_GITHUB_THEME_NAME);
    expect(ALL_CHAT_CODE_THEME_NAMES).toContain("catppuccin-mocha");
    expect(ALL_CHAT_CODE_THEME_NAMES).toContain("pierre-dark");
  });
});

describe("Draft Chat code theme", () => {
  it("uses the expected darker surface background", () => {
    expect(DRAFT_CHAT_CODE_THEME_BACKGROUND).toBe("#1a1821");
  });
});
