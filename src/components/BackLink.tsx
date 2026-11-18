"use client";

import Link from "next/link";

/** כפתור חזרה מקצועי — בראש עמודי פירוט (RTL: החץ שמאלה = קדימה בהיסטוריית ניווט) */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-cz-mut transition-colors hover:bg-cz-sand hover:text-cz-red"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
        <path d="M9.3 5.3 3.6 11a1 1 0 0 0 0 1.4l5.7 5.7a1 1 0 0 0 1.4-1.4L6.4 12l4.3-4.3a1 1 0 1 0-1.4-1.4z" transform="translate(24 0) scale(-1 1)" />
      </svg>
      {label}
    </Link>
  );
}
