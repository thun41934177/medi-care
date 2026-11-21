import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useApp } from "../store";
import { openUserDb } from "../db";
import { stopSpeaking } from "./speech";
import { syncAll } from "./sync";

export interface AuthUser { id: string; username: string; name: string; room: string; roomCode: string; isAdmin: boolean }
interface Ctx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string>; // returns an error message, or "" when it worked
  signup: (v: { name: string; username: string; password: string; room: string }) => Promise<string>;
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

  const apply = useCallback((u: AuthUser | null) => {
    if (u) { openUserDb(u.id); setRef.current({ name: u.name, room: u.room }); }
    setUser(u);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        apply(me.ok ? await me.json() : null);
      } catch { apply(null); }
      setLoading(false);
    })();
  }, [apply]);

  // if the server says "not signed in" (session ended), return to the login screen
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

  // heartbeat (shows "online" to the administrator) and a copy of this resident's records
  useEffect(() => {
    if (!user) return;
    const ping = () => fetch("/api/ping", { method: "POST" }).catch(() => {});
    ping();
    if (!user.isAdmin) syncAll();
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
    user, loading,
    login: (username, password) => send("/api/auth/login", { username, password }),
    signup: (v) => send("/api/auth/signup", v),
    logout: async () => { stopSpeaking(); await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); apply(null); },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
