import { describe, expect, it } from "vitest";

import {
  createDesktopBackendWsUrl,
  DESKTOP_BACKEND_READY_PREFIX,
  formatDesktopBackendReadyLine,
  parseDesktopBackendReadyLine,
} from "./desktopBackend";

describe("desktopBackend", () => {
  it("formats and parses backend ready lines", () => {
    const line = formatDesktopBackendReadyLine({ port: 43121 });

    expect(line).toBe(`${DESKTOP_BACKEND_READY_PREFIX}{"port":43121}`);
    expect(parseDesktopBackendReadyLine(line)).toEqual({ port: 43121 });
  });

  it("ignores non-ready lines and invalid payloads", () => {
    expect(parseDesktopBackendReadyLine("hello world")).toBeNull();
    expect(parseDesktopBackendReadyLine(`${DESKTOP_BACKEND_READY_PREFIX}{}`)).toBeNull();
    expect(parseDesktopBackendReadyLine(`${DESKTOP_BACKEND_READY_PREFIX}{"port":0}`)).toBeNull();
    expect(
      parseDesktopBackendReadyLine(`${DESKTOP_BACKEND_READY_PREFIX}{"port":"43121"}`),
    ).toBeNull();
  });

  it("builds desktop websocket urls with encoded auth tokens", () => {
    expect(createDesktopBackendWsUrl({ port: 3773, authToken: "token with spaces" })).toBe(
      "ws://127.0.0.1:3773/?token=token%20with%20spaces",
    );
  });
});
