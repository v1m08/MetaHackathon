"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SWRConfig } from "swr";
import { DEFAULT_USER, SessionContext, readUserId, writeUserId } from "@/lib/session";

export function Providers({ children }: { children: React.ReactNode }) {
  const [userId, setUser] = useState(DEFAULT_USER);
  const [frame, setFrame] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
