"use client";

import { useEffect, useState } from "react";
import { Btn, Modal } from "./ui";

/** מודל אישור מקצועי — למחיקות ופעולות רגישות (במקום window.confirm/prompt). */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "אישור",
  danger,
  inputLabel,
  inputPlaceholder,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** שדה טקסט אופציונלי (למשל סיבה/הערה) */
  inputLabel?: string;
  inputPlaceholder?: string;
  busy?: boolean;
  onConfirm: (input?: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");

  useEffect(() => {
    if (open) setInput("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {message && (
          <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${danger ? "bg-cz-red-soft text-cz-red" : "bg-cz-bg text-cz-ink"}`}>
            {message}
          </p>
        )}
        {inputLabel && (
          <div>
            <label className="label">{inputLabel}</label>
            <input
              className="field"
              value={input}
              placeholder={inputPlaceholder}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>ביטול</Btn>
          <Btn
            variant={danger ? "danger-soft" : "primary"}
            loading={busy}
            onClick={() => onConfirm(inputLabel ? input : undefined)}
          >
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
