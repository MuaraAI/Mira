"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, X } from "lucide-react";
import { FocusDialog } from "@/components/FocusDialog";
import { lockScroll } from "@/lib/scroll-lock";

type Tone = "default" | "danger";

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

interface Notice {
  id: number;
  message: string;
  tone: "error" | "success";
}

interface DialogApi {
  /** Pengganti window.confirm: resolve true kalau pengguna menekan tombol konfirmasi. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Pengganti alert(): pesan singkat di pojok layar yang hilang sendiri. */
  notify: (message: string, tone?: Notice["tone"]) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog harus dipakai di dalam <DialogProvider>");
  return api;
}

function ConfirmModal({
  options,
  onResolve,
}: {
  options: ConfirmOptions;
  onResolve: (value: boolean) => void;
}) {
  const danger = options.tone === "danger";
  const Icon = danger ? AlertTriangle : HelpCircle;
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => lockScroll(), []);
  // Fokus awal di "Batal" supaya Enter tidak langsung menjalankan aksi berbahaya.
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="modal-backdrop fixed inset-0 bg-[#072033]/55 backdrop-blur-[2px]" onClick={() => onResolve(false)} aria-hidden="true" />
      <FocusDialog
        open
        onClose={() => onResolve(false)}
        labelledBy="confirm-title"
        className="sheet-panel relative w-full bg-white max-sm:shadow-[0_-2px_0_0_#163A55] sm:max-w-md sm:px-card sm:[--px-drop:#0369A1] sm:[--px-off:8px]"
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center ${
              danger ? "bg-[#FFF1F2] text-[#BE123C] shadow-[inset_0_0_0_2px_#FDA4AF]" : "px-icon"
            }`}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="confirm-title" className="font-display text-lg font-bold leading-snug text-foreground">
              {options.title}
            </h2>
            {options.message && <div className="mt-2 text-sm leading-6 text-secondary">{options.message}</div>}
          </div>
          <button
            type="button"
            onClick={() => onResolve(false)}
            aria-label="Tutup"
            className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center text-secondary transition-colors hover:bg-px-tint hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t-2 border-px-soft bg-surface-alt px-5 py-4 sm:flex sm:justify-end sm:px-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResolve(false)}
            className="px-btn-ghost inline-flex min-h-11 items-center justify-center px-5 text-sm font-semibold"
          >
            {options.cancelLabel ?? "Batal"}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`px-btn inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold ${
              danger ? "[--px-drop:#FDA4AF] [--px-line:#9F1239] !bg-[#BE123C]" : ""
            }`}
          >
            {options.confirmLabel ?? "Lanjutkan"}
          </button>
        </div>
      </FocusDialog>
    </div>
  );
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((current) => {
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    [],
  );

  const notify = useCallback((message: string, tone: Notice["tone"] = "error") => {
    const id = ++nextId.current;
    setNotices((list) => [...list.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setNotices((list) => list.filter((n) => n.id !== id)), 4500);
  }, []);

  const resolve = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      {pending && <ConfirmModal options={pending.options} onResolve={resolve} />}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end lg:bottom-8"
        aria-live="polite"
      >
        {notices.map((notice) => {
          const ok = notice.tone === "success";
          const Icon = ok ? CheckCircle2 : AlertTriangle;
          return (
            <div
              key={notice.id}
              role={ok ? "status" : "alert"}
              className="menu-drop pointer-events-auto flex w-full max-w-sm items-start gap-3 bg-white p-4 text-sm text-foreground shadow-[0_-2px_0_0_#163A55,0_2px_0_0_#163A55,-2px_0_0_0_#163A55,2px_0_0_0_#163A55,6px_6px_0_0_var(--drop)]"
              style={{ ["--drop" as string]: ok ? "#0F766E" : "#BE123C" }}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? "text-[#0F766E]" : "text-[#BE123C]"}`} aria-hidden="true" />
              <p className="flex-1 leading-5">{notice.message}</p>
              <button
                type="button"
                onClick={() => setNotices((list) => list.filter((n) => n.id !== notice.id))}
                aria-label="Tutup pesan"
                className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center text-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </DialogContext.Provider>
  );
}
