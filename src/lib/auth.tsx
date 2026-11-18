import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useApp } from "../store";
import { openUserDb } from "../db";
import { syncMeds } from "./sync";
import { stopSpeaking } from "./speech";

export interface AuthUser { id: string; username: string; name: string; room: string; role: "admin" | "user"; roomCode: string }
interface Ctx {
  user: AuthUser | null;
  loading: boolean;
  hasAdmin: boolean;
  login: (username: string, password: string) => Promise<string>; // returns an error message, or "" when it worked
  setup: (name: string, username: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(C);

const json = { "Content-Type": "application/json" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const { set } = useApp();
  const setRef = useRef(set);
  setRef.current = set;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(true);

  const apply = useCallback((u: AuthUser | null) => {
    if (u) { openUserDb(u.id); setRef.current({ name: u.name, room: u.room }); }
    setUser(u);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [me, st] = await Promise.all([fetch("/api/auth/me"), fetch("/api/auth/status")]);
        if (st.ok) setHasAdmin((await st.json()).hasAdmin);
        apply(me.ok ? await me.json() : null);
      } catch { apply(null); }
      setLoading(false);
    })();
  }, [apply]);

  // if the server says "not signed in" (session ended or account disabled), return to the login screen
  useEffect(() => {
    const orig = window.fetch;
    window.fetch = async (input, init) => {
      const r = await orig(input, init);
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (r.status === 401 && url.startsWith("/api/") && !url.startsWith("/api/auth/")) setUser(null);
      return r;
    };
    return () => { window.fetch = orig; };
  }, []);

  // heartbeat (shows "online" to the admin) and a full copy of the medicine schedule
  useEffect(() => {
    if (!user) return;
    const ping = () => fetch("/api/ping", { method: "POST" }).catch(() => {});
    ping();
    if (user.role === "user") syncMeds();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(url: string, body: unknown): Promise<string> {
    try {
      const r = await fetch(url, { method: "POST", headers: json, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return d.error || "Something went wrong. Please try again.";
      apply(d);
      return "";
    } catch { return "Cannot reach the server."; }
  }

  const value: Ctx = {
    user, loading, hasAdmin,
    login: (username, password) => send("/api/auth/login", { username, password }),
    setup: async (name, username, password) => { const e = await send("/api/auth/setup", { name, username, password }); if (!e) setHasAdmin(true); return e; },
    logout: async () => { stopSpeaking(); await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); apply(null); },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
