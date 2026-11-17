"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/client";
import { Spinner } from "./ui";
import type { StoredFile } from "@/lib/types";

/** העלאת קבצים עם גרירה, מצב טעינה ורשימת קבצים שהועלו. */
export default function FileUploader({
  onUploaded,
  onError,
  accept = "application/pdf,image/*",
  hint = "PDF או תמונות · עד 25MB",
  compact,
  capture,
}: {
  onUploaded: (file: StoredFile) => void;
  onError?: (message: string) => void;
  accept?: string;
  hint?: string;
  compact?: boolean;
  /** צילום ישיר ממצלמת הטלפון (נייד) — כפתור "צלם" מתחת לאזור ההעלאה */
  capture?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        try {
          onUploaded(await uploadFile(file));
        } catch (err) {
          onError?.(err instanceof Error ? `${file.name}: ${err.message}` : "העלאה נכשלה");
        }
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed text-center transition-colors ${
          drag ? "border-cz-red bg-cz-red-soft/40" : "border-cz-line bg-cz-input hover:border-cz-red/60"
        } ${compact ? "px-4 py-4" : "px-4 py-8"}`}
      >
        {busy ? (
          <Spinner className="size-6 text-cz-red" />
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-7 text-cz-mut">
            <path d="M12 3 6 9h4v6h4V9h4zM4 19h16v2H4z" />
          </svg>
        )}
        <div className="text-sm font-bold">{busy ? "מעלה קבצים…" : "לחצו להעלאה או גררו לכאן"}</div>
        {!compact && <div className="text-xs text-cz-fog">{hint}</div>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {capture && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-cz-line bg-white text-sm font-bold text-cz-ink transition-colors hover:border-cz-red/50 hover:text-cz-red md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
              <path d="M9 4 7.6 5.6H5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.6a2 2 0 0 0-2-2h-2.6L15 4zm3 5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
            </svg>
            צלם מהמצלמה
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            aria-hidden
            tabIndex={-1}
          />
        </>
      )}
    </div>
  );
}

export function FileChip({ file, onRemove }: { file: StoredFile; onRemove?: () => void }) {
  const isImage = file.mime.startsWith("image/");
  return (
    <div className="flex items-center gap-2 rounded-full border border-cz-line bg-white py-1 pe-2 ps-1">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/${file.id}`} alt={file.originalName} className="size-8 rounded-full object-cover" />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-cz-red-soft text-cz-red text-[10px] font-bold">PDF</span>
      )}
      <a href={`/api/files/${file.id}?download=1`} className="max-w-40 truncate text-sm font-semibold hover:text-cz-red" title={file.originalName}>
        {file.originalName}
      </a>
      {onRemove && (
        <button onClick={onRemove} className="grid size-6 place-items-center rounded-full text-cz-mut hover:bg-cz-sand" aria-label="הסרה">✕</button>
      )}
    </div>
  );
}
