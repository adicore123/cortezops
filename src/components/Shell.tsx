"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth";
import { Badge, fmtDateTime } from "./ui";
import GlobalSearch from "./GlobalSearch";

// ─── אייקונים (SVG מינימליים) ──────────────────────────────────────────────

const ICONS: Record<string, string> = {
  dashboard: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  cases: "M4 5a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2 4h12v8H6z",
  defects: "M12 2 1 21h22zM11 10h2v6h-2zm0 7h2v2h-2z",
  models: "M15 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 17c0-3 3-4.5 6-4.5s6 1.5 6 4.5v2H4zM17.5 8l3.5 6h-7z",
  parts: "M21 8l-2 2-2.5-2.5L17 5zM11 11l5 5-7 7H4v-5zM3 3l4 4-2 2-4-4z",
  repairs: "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z",
  service: "M14 6a4 4 0 1 0-1.5 7.7L15 16h2v2h2v2h3v-3l-6.7-6.7A4 4 0 0 0 14 6zM3 8l6 6 2-2-6-6z",
  knowledge: "M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4zM20 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4-2.1-.6-.5-1.3 1.1-1.9-1.7-1.7-1.9 1.1-1.3-.5L14.1 4h-2.4l-.6 2.1-1.3.5L7.9 5.5 6.2 7.2l1.1 1.9-.5 1.3L4.7 11v2.4l2.1.6.5 1.3-1.1 1.9 1.7 1.7 1.9-1.1 1.3.5.6 2.1h2.4l.6-2.1 1.3-.5 1.9 1.1 1.7-1.7-1.1-1.9.5-1.3 2.1-.6z",
};

function Icon({ name, className = "size-5" }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  shortLabel: string; // לסרגל התחתון בנייד
  icon: string;
  show: boolean;
  badge?: number;
}

export interface ShellNotification {
  id: string;
  message: string;
  link?: string;
  createdAt: string;
  read: boolean;
}

export default function Shell({
  user,
  importerName,
  logoUrl,
  notifications,
  openDefects = 0,
  activeRepairs = 0,
  children,
}: {
  user: PublicUser;
  importerName: string;
  logoUrl: string;
  notifications: ShellNotification[];
  openDefects?: number;
  activeRepairs?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notes, setNotes] = useState(notifications);
  const bellRef = useRef<HTMLDivElement>(null);

  const nav: NavItem[] = [
    { href: "/", label: "לוח בקרה", shortLabel: "בקרה", icon: "dashboard", show: true },
    { href: "/repairs", label: "תיקונים ומעבדה", shortLabel: "תיקונים", icon: "repairs", show: user.role === "admin" || (user.role === "staff" && user.permissions.service) || user.role === "agent", badge: activeRepairs || undefined },
    { href: "/cases", label: "תיקי מכון התקנים", shortLabel: "תקנים", icon: "cases", show: user.role === "admin" || (user.role === "staff" && user.permissions.cases) },
    { href: "/defects", label: "ליקויים", shortLabel: "ליקויים", icon: "defects", show: user.role === "admin" || (user.role === "staff" && user.permissions.cases), badge: openDefects || undefined },
    { href: "/models", label: "מאגר דגמים", shortLabel: "דגמים", icon: "models", show: true },
    { href: "/parts", label: "מלאי חלפים", shortLabel: "חלפים", icon: "parts", show: user.role === "admin" || (user.role === "staff" && user.permissions.inventory) },
    { href: "/service", label: "קריאות שירות", shortLabel: "שירות", icon: "service", show: true },
    { href: "/knowledge", label: "מרכז תקלות ומדריכים", shortLabel: "תקלות", icon: "knowledge", show: true },
    { href: "/settings", label: "הגדרות", shortLabel: "הגדרות", icon: "settings", show: user.role === "admin" },
  ].filter((n) => n.show);

  const unread = notes.filter((n) => !n.read).length;

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notifications);
      }
    } catch { /* שרת לא זמין זמנית */ }
  }, []);

  useEffect(() => {
    const t = setInterval(poll, 45000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    setNotes((n) => n.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications/read-all", { method: "POST" });
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const roleLabel = user.role === "admin" ? "מנהל מערכת" : user.role === "staff" ? "צוות יבואן" : "סוכן";

  const sidebarInner = (
    <div className="flex h-full flex-col bg-cz-asphalt text-cz-on-dark">
      {/* לוגו */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={importerName} className="h-9 w-auto" />
        <div className="min-w-0">
          <div className="font-display font-extrabold text-white leading-none">{importerName}</div>
          <div className="mt-1 text-[11px] text-white/50">מערכת תפעול פנימית</div>
        </div>
      </div>

      {/* ניווט */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-bold transition-colors ${
                active ? "bg-cz-red-bright text-white shadow-[0_6px_16px_rgba(232,35,28,.35)]" : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="num ms-auto grid min-w-6 place-items-center rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* משתמש */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{user.name}</div>
            <div className="text-xs text-white/50">{roleLabel}</div>
          </div>
          <button onClick={logout} className="grid size-10 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" title="התנתקות" aria-label="התנתקות">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M10 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8v-2h8V5h-8zm1 5 1.4 1.4L10.8 11H15v2h-4.2l1.6 1.6L11 16l-4-4zM5 11h4v2H5z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* סרגל צד — דסקטופ (ימני בזכות RTL) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[264px] shrink-0 lg:block">{sidebarInner}</aside>

      {/* מגירת נייד */}
      {menuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-cz-asphalt/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[280px] max-w-[85vw] shadow-2xl">{sidebarInner}</div>
        </div>
      )}

      {/* תוכן */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* פס עליון */}
        <header className="no-print sticky top-0 z-40 flex items-center gap-3 border-b border-cz-line-soft bg-cz-bg/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            className="grid size-11 place-items-center rounded-full hover:bg-cz-sand lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="פתיחת תפריט"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-6"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="h-7 w-auto" />
          </div>

          {/* חיפוש גלובלי */}
          <GlobalSearch />

          <div className="ms-auto flex items-center gap-2">
            {/* התראות */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="relative grid size-11 place-items-center rounded-full hover:bg-cz-sand"
                aria-label="התראות"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M12 2a6 6 0 0 0-6 6v3.6L4 14v2h16v-2l-2-2.4V8a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0z" /></svg>
                {unread > 0 && (
                  <span className="num absolute -top-0.5 -left-0.5 grid min-w-5 place-items-center rounded-full bg-cz-red px-1 text-[11px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute end-0 top-13 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-cz-line bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-cz-line-soft px-4 py-3">
                    <div className="font-display font-bold">התראות</div>
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-xs font-bold text-cz-red hover:underline">סמן הכל כנקרא</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notes.length === 0 && <div className="px-4 py-8 text-center text-sm text-cz-mut">אין התראות</div>}
                    {notes.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link ?? "#"}
                        onClick={() => setBellOpen(false)}
                        className={`block border-b border-cz-line-soft px-4 py-3 text-sm hover:bg-cz-bg ${n.read ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cz-red" />}
                          <div className="min-w-0">
                            <div className="font-semibold leading-snug">{n.message}</div>
                            <div className="mt-0.5 text-xs text-cz-fog">{fmtDateTime(n.createdAt)}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* זיהוי משתמש — גלוי תמיד, כולל בנייד */}
            <div className="flex items-center gap-2 rounded-full border border-cz-line-soft bg-white px-2 py-1.5 sm:px-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cz-ink text-xs font-bold text-white">
                {user.name.slice(0, 1)}
              </span>
              <span className="max-w-28 truncate text-sm font-bold sm:max-w-none">{user.name}</span>
              <span className="hidden sm:inline-flex">
                <Badge tone={user.role === "admin" ? "red" : user.role === "staff" ? "blue" : "gray"}>
                  {roleLabel}
                </Badge>
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:py-8 lg:pb-8">{children}</main>

        <footer className="no-print px-6 pb-24 text-center text-xs text-cz-fog lg:pb-6">
          © {new Date().getFullYear()} {importerName} · מערכת תפעול פנימית
        </footer>
      </div>

      {/* סרגל ניווט תחתון לנייד — כל המודולים תמיד גלויים */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-cz-asphalt lg:hidden"
        aria-label="ניווט ראשי"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[10px] font-bold transition-colors ${
                  active ? "text-cz-red-bright" : "text-white/55 active:text-white"
                }`}
              >
                <span className="relative">
                  <Icon name={item.icon} className="size-[22px]" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="num absolute -top-1.5 -left-2 grid min-w-4.5 place-items-center rounded-full bg-cz-red-bright px-1 text-[10px] leading-4 text-white">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{item.shortLabel}</span>
                {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-cz-red-bright" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
