"use client";

/** כפתורי בקרה לעמודי הדפסה (לקוח — כי משתמשים ב־window.print) */
export default function PrintControls({ info }: { info?: string }) {
  return (
    <div className="no-print mb-6 flex items-center gap-2 print:hidden">
      <button onClick={() => window.print()} className="rounded-full bg-cz-red px-6 py-2.5 font-bold text-white hover:bg-cz-red-dark">הדפסה</button>
      <button onClick={() => window.close()} className="rounded-full border border-cz-line px-6 py-2.5 font-bold hover:border-cz-red hover:text-cz-red">סגירה</button>
      {info && <span className="ms-2 text-sm text-cz-mut">{info}</span>}
    </div>
  );
}
