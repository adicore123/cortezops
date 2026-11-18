"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── עמוד כניסה — מיתוג CORTEZ ───────────────────────────────────────────────
// דסקטופ: חלוקה לשני צדדים — פאנל מותג כהה (אספלט, לוגו לבן, טיפוגרפיה)
// וצד טופס בהיר. נייד: מסך אחד — כרטיס לוגו כהה קומפקטי מעל הטופס.

const MODEL_LINES = ["CORTEZ MAX 3 2027", "CORTEZ SPORT RS", "CORTEZ 10X", "CORTEZ MIA"];

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
    <div className="flex min-h-dvh">
      {/* פאנל מותג — דסקטופ בלבד */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-cz-asphalt p-12 lg:flex">
        <div className="pointer-events-none absolute -top-48 start-1/2 h-[28rem] w-[36rem] -translate-x-1/2 rounded-full bg-cz-red/25 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-56 end-[-6rem] h-96 w-96 rounded-full bg-cz-red/15 blur-[110px]" />

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cortez.png" alt="קורטז" className="h-12 w-auto" />
        </div>

        <div className="relative">
          <div className="num mb-4 text-xs font-bold tracking-widest text-cz-red-bright">01 / מערכת תפעול פנימית</div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white">
            תיקי מכון התקנים
            <br />
            דגמים · חלפים · שירות
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/50">
            המערכת התפעולית של קורטז — יבואן רשמי של אופניים וקורקינטים חשמליים. כל המידע על דגם, תיק או קריאה — במקום אחד.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold tracking-wide text-white/35">
          {MODEL_LINES.map((m) => (
            <span key={m} dir="ltr">{m}</span>
          ))}
        </div>
      </div>

      {/* צד הטופס */}
      <div className="flex w-full items-center justify-center bg-cz-bg px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* לוגו בנייד — על גבי כרטיס כהה (הלוגו הלבן דורש רקע כהה) */}
          <div className="mb-6 flex flex-col items-center gap-2.5 rounded-3xl bg-cz-asphalt px-6 py-7 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/cortez.png" alt="קורטז" className="h-10 w-auto" />
            <div className="font-display text-base font-extrabold text-white">מערכת תפעול פנימית</div>
          </div>

          <h2 className="mb-1 font-display text-2xl font-extrabold">כניסה למערכת</h2>
          <p className="mb-6 text-sm text-cz-mut">הזינו שם משתמש וסיסמה כדי להמשיך</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="username" className="label">שם משתמש</label>
              <input
                id="username"
                className="field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                dir="ltr"
                placeholder="admin"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">סיסמה</label>
              <input
                id="password"
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-cz-red-soft px-4 py-2.5 text-sm font-bold text-cz-red" role="alert">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="min-h-12 w-full rounded-full bg-cz-red text-base font-extrabold text-white shadow-[0_8px_24px_rgba(200,10,4,.3)] transition-all hover:bg-cz-red-dark disabled:opacity-50"
            >
              {loading ? "מתחבר…" : "כניסה למערכת"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-cz-line-soft bg-white px-4 py-3 text-center text-xs leading-relaxed text-cz-mut">
            <div><b className="text-cz-ink">מנהל — כל המודולים:</b> <span dir="ltr">admin / admin123</span></div>
            <div>צוות יבואן: <span dir="ltr">danny / danny123</span> · סוכן (שירות ותיקונים): <span dir="ltr">avi / avi123</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
