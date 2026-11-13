"use client";
// Per-tab identity. Priority: ?as=<id> in the URL → sessionStorage (this tab) → localStorage (last used) → default.
// Two browser windows can therefore act as two different people at the same time.
import { createContext, useContext } from "react";

export const DEFAULT_USER = "maya";
const KEY = "fb.userId";

export function readUserId(): string {
  if (typeof window === "undefined") return DEFAULT_USER;
  const fromUrl = new URLSearchParams(window.location.search).get("as");
  if (fromUrl) {
    sessionStorage.setItem(KEY, fromUrl);
    localStorage.setItem(KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || DEFAULT_USER;
}

/** Has someone been picked in this browser (URL, this tab, or last used)? A home-screen app starts with none: iOS gives it its own storage. */
export function hasIdentity(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!(new URLSearchParams(window.location.search).get("as") || sessionStorage.getItem(KEY) || localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function writeUserId(id: string) {
  sessionStorage.setItem(KEY, id);
  localStorage.setItem(KEY, id);
}

export interface SessionValue {
  userId: string;
  setUserId: (id: string) => void;
  frame: boolean;
}
export const SessionContext = createContext<SessionValue>({ userId: DEFAULT_USER, setUserId: () => {}, frame: true });
export const useSession = () => useContext(SessionContext);
