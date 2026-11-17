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
}: {
  onUploaded: (file: StoredFile) => void;
  onError?: (message: string) => void;
  accept?: string;
  hint?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
