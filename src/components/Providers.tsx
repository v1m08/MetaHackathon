"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SWRConfig } from "swr";
import { DEFAULT_USER, SessionContext, hasIdentity, readUserId, writeUserId } from "@/lib/session";

// The public demo build sets this to the picker page. With it, a browser that hasn't picked a person yet (a fresh
// phone, or the app opened from the home screen, which has its own storage on iOS) is sent to the picker instead of
// silently becoming the default account.
const PICKER = process.env.NEXT_PUBLIC_DEMO_PICKER;
const NO_PICK_NEEDED = /^\/(demo|admin|dev)(\/|$)/;

export function Providers({ children }: { children: React.ReactNode }) {
  const [userId, setUser] = useState(DEFAULT_USER);
  const [frame, setFrame] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (PICKER && !hasIdentity() && !NO_PICK_NEEDED.test(window.location.pathname)) {
      window.location.replace(PICKER);
      return;
    }
    setUser(readUserId());
    const q = new URLSearchParams(window.location.search);
    if (q.has("frame")) localStorage.setItem("fb.frame", q.get("frame") === "0" ? "0" : "1");
    setFrame(localStorage.getItem("fb.frame") !== "0");
    setReady(true);
  }, []);

  const setUserId = useCallback((id: string) => {
    writeUserId(id);
    setUser(id);
  }, []);

  const value = useMemo(() => ({ userId, setUserId, frame }), [userId, setUserId, frame]);

  return (
    <SessionContext.Provider value={value}>
      <SWRConfig value={{ dedupingInterval: 1000, errorRetryCount: 2 }}>{ready ? children : null}</SWRConfig>
    </SessionContext.Provider>
  );
}
