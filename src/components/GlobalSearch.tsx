"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── חיפוש גלובלי ────────────────────────────────────────────────────────────
// שולחן עבודה: שדה חיפוש קבוע בפס העליון עם תוצאות מקובצות לפי קטגוריה.
// נייד: כפתור זכוכית מגדלת שפותח פאנל חיפוש מרחף.
// ניווט מקלדת: חצים לבחירה, Enter לפתיחה, Escape לסגירה.

interface SearchItem {
  id: string;
  title: string;
  sub?: string;
  href: string;
}

interface SearchGroup {
  key: string;
  label: string;
  items: SearchItem[];
}

function SearchGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false); // מצב פאנל נייד
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // רשימה שטוחה לניווט מקלדת
  const flat = useMemo(
    () => groups.flatMap((g) => g.items.map((item) => ({ group: g.label, item }))),
    [groups]
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // חיפוש עם השהיה (debounce) + ביטול בקשות קודמות
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const data = (await res.json()) as { groups?: SearchGroup[] };
        setGroups(data.groups ?? []);
        setActive(0);
      } catch {
        /* בקשה בוטלה או שרת לא זמין */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, groups]);

  function reset() {
    setOpen(false);
    setQ("");
    setGroups([]);
  }

  function select(item: SearchItem) {
    reset();
    router.push(item.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      reset();
      inputRef.current?.blur();
      return;
    }
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = flat[active];
      if (sel) select(sel.item);
    }
  }

  const results = (
    <div ref={listRef} className="max-h-[min(26rem,60vh)] overflow-y-auto" role="listbox" aria-label="תוצאות חיפוש">
      {q.trim().length >= 2 && !loading && groups.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-cz-mut">אין תוצאות עבור &quot;{q.trim()}&quot;</div>
      )}
      {loading && q.trim().length >= 2 && (
        <div className="px-4 py-8 text-center text-sm text-cz-fog">מחפש…</div>
      )}
      {groups.map((g) => (
        <div key={g.key}>
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-cz-line-soft bg-cz-bg/95 px-4 py-2 backdrop-blur">
            <span className="num text-[11px] font-bold text-cz-red">{String(groups.indexOf(g) + 1).padStart(2, "0")}</span>
            <span className="text-xs font-bold text-cz-mut">{g.label}</span>
          </div>
          {g.items.map((item) => {
            const idx = flat.findIndex((f) => f.item.id === item.id && f.group === g.label);
            return (
              <button
                key={`${g.key}-${item.id}`}
                type="button"
                data-idx={idx}
                role="option"
                aria-selected={idx === active}
                onClick={() => select(item)}
                onMouseEnter={() => setActive(idx)}
                className={`flex w-full items-center gap-3 border-b border-cz-line-soft px-4 py-3 text-start transition-colors ${
                  idx === active ? "bg-cz-red-soft" : "hover:bg-cz-bg"
                }`}
              >
                <SearchGlyph className="size-4 shrink-0 text-cz-fog" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{item.title}</span>
                  {item.sub && <span className="block truncate text-xs text-cz-mut">{item.sub}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const desktopInput = (
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={onKey}
      type="search"
      placeholder="חיפוש דגם, תיק, חלק או קריאה…"
      aria-label="חיפוש גלובלי"
      className="min-h-11 w-72 rounded-full border border-cz-line bg-white ps-11 pe-4 text-[15px] outline-none transition-colors placeholder:text-cz-fog focus:border-cz-red focus:shadow-[0_0_0_3px_rgba(200,10,4,.12)]"
    />
  );

  return (
    <div ref={boxRef} className="flex items-center">
      {/* דסקטופ */}
      <div className="relative hidden lg:block">
        <div className="relative">
          <SearchGlyph className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-cz-fog" />
          {desktopInput}
        </div>
        {(q.trim().length >= 2 || (loading && q.trim().length >= 2)) && (
          <div className="absolute start-0 top-full z-50 mt-2 w-[26rem] overflow-hidden rounded-2xl border border-cz-line bg-white shadow-2xl">
            {results}
          </div>
        )}
      </div>

      {/* נייד */}
      <div className="relative lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid size-11 place-items-center rounded-full hover:bg-cz-sand"
          aria-label="חיפוש"
          aria-expanded={open}
        >
          <SearchGlyph className="size-5" />
        </button>
        {open && (
          <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-cz-line bg-white shadow-2xl">
            <div className="relative border-b border-cz-line-soft">
              <SearchGlyph className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-cz-fog" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                type="search"
                inputMode="search"
                placeholder="חיפוש דגם, תיק, חלק או קריאה…"
                aria-label="חיפוש גלובלי"
                className="w-full bg-transparent px-11 py-3.5 text-[15px] outline-none placeholder:text-cz-fog"
              />
            </div>
            {results}
          </div>
        )}
      </div>
    </div>
  );
}
