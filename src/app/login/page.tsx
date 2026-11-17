"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאת כניסה");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-cz-asphalt px-4">
      {/* אדום זוהר בסגנון האתר */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-cz-red/25 blur-[120px]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cortez.png" alt="קורטז" className="h-14 w-auto" />
          <div className="font-display text-xl font-extrabold text-white">מערכת תפעול פנימית</div>
          <div className="text-sm text-white/50">תיקי מכון התקנים · דגמים · חלפים · שירות</div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-cz-dark/80 p-6 shadow-2xl backdrop-blur">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-white/80">שם משתמש</label>
            <input
              className="min-h-11 w-full rounded-xl border border-white/15 bg-cz-dark-2 px-4 text-white placeholder:text-white/30 outline-none focus:border-cz-red-bright"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              dir="ltr"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-white/80">סיסמה</label>
            <input
              type="password"
              className="min-h-11 w-full rounded-xl border border-white/15 bg-cz-dark-2 px-4 text-white placeholder:text-white/30 outline-none focus:border-cz-red-bright"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-cz-red-soft/15 px-4 py-2.5 text-sm font-bold text-cz-red-bright">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-full bg-cz-red-bright text-base font-extrabold text-white shadow-[0_8px_24px_rgba(232,35,28,.4)] transition-all hover:bg-cz-red disabled:opacity-50"
          >
            {loading ? "מתחבר…" : "כניסה למערכת"}
          </button>

          <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs leading-relaxed text-white/60">
            <div><b className="text-white/85">מנהל — כל המודולים:</b> <span dir="ltr">admin / admin123</span></div>
            <div>צוות יבואן: <span dir="ltr">danny / danny123</span> · סוכן (קריאות בלבד): <span dir="ltr">avi / avi123</span></div>
          </div>
        </form>
      </div>
    </div>
  );
}
