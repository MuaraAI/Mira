"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Pencil, Pin, PinOff, Plus, Reply, RotateCcw, Trash2, X } from "lucide-react";
import { Emoji, QUICK_REACTIONS, REACTIONS, REACTION_LABEL } from "@/components/social/Emoji";
import { FocusDialog } from "@/components/FocusDialog";
import { lockScroll } from "@/lib/scroll-lock";
import type { Message, ReactionKey } from "@/lib/social";

export interface MenuTarget {
  message: Message;
  /** Posisi bubble di layar; dipakai popover desktop untuk menempel di samping bubble. */
  rect: DOMRect;
  /** Buka langsung panel emoji lengkap (tombol tambah reaksi). */
  pickerOnly?: boolean;
}

export interface MenuPermissions {
  mine: boolean;
  canPin: boolean;
  canDelete: boolean;
}

const MENU_WIDTH = 328;

export function MessageMenu({
  target,
  me,
  sheet,
  permissions,
  onClose,
  onReact,
  onReply,
  onCopy,
  onPin,
  onEdit,
  onDelete,
  onRetry,
}: {
  target: MenuTarget;
  me: string;
  /** true di layar sempit/sentuh: tampil sebagai bottom sheet. */
  sheet: boolean;
  permissions: MenuPermissions;
  onClose: () => void;
  onReact: (key: ReactionKey) => void;
  onReply: () => void;
  onCopy: () => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const { message } = target;
  const [expanded, setExpanded] = useState(!!target.pickerOnly);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const mineReacted = new Set(message.reactions.filter((r) => r.users.includes(me)).map((r) => r.key));
  const failed = message.local === "failed";
  const pending = !!message.local;

  useEffect(() => lockScroll(), []);

  // Desktop: tempel di sisi bubble, jaga tetap di dalam layar.
  useLayoutEffect(() => {
    if (sheet) return;
    const height = panel.current?.offsetHeight ?? 320;
    const { rect } = target;
    const gap = 8;
    const preferLeft = permissions.mine ? rect.right - MENU_WIDTH : rect.left;
    const left = Math.min(Math.max(12, preferLeft), window.innerWidth - MENU_WIDTH - 12);
    const below = rect.bottom + gap;
    const top = below + height < window.innerHeight - 12 ? below : Math.max(12, rect.top - height - gap);
    setPos({ top, left });
  }, [sheet, target, permissions.mine, expanded]);

  const actions = [
    failed && { label: "Kirim ulang", icon: RotateCcw, run: onRetry },
    !pending && { label: "Balas", icon: Reply, run: onReply },
    { label: "Salin teks", icon: Copy, run: onCopy },
    !pending && permissions.canPin && { label: message.pinned ? "Lepas sematan" : "Sematkan", icon: message.pinned ? PinOff : Pin, run: onPin },
    !pending && permissions.mine && { label: "Edit", icon: Pencil, run: onEdit },
    (failed || (!pending && permissions.canDelete)) && { label: failed ? "Buang" : "Hapus", icon: Trash2, run: onDelete, danger: true },
  ].filter(Boolean) as { label: string; icon: typeof Reply; run: () => void; danger?: boolean }[];

  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const reactionBar = !pending && !target.pickerOnly && (
    <div className="flex items-center gap-1 px-2 py-2">
      {QUICK_REACTIONS.map((key, i) => (
        <button
          key={key}
          type="button"
          onClick={pick(() => onReact(key))}
          aria-label={REACTION_LABEL[key]}
          aria-pressed={mineReacted.has(key)}
          title={REACTION_LABEL[key]}
          style={{ animationDelay: `${i * 25}ms` }}
          className={`react-pop flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-150 hover:-translate-y-1 hover:scale-110 md:h-10 md:w-10 ${
            mineReacted.has(key) ? "bg-[#DCEBF5] shadow-[0_0_0_2px_#0369A1]" : "hover:bg-[#F0F7FB]"
          }`}
        >
          <Emoji name={key} size={30} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Tutup semua reaksi" : "Semua reaksi"}
        aria-expanded={expanded}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center text-[#3B5A70] hover:bg-[#F0F7FB] hover:text-[#072033] md:h-10 md:w-10"
      >
        {expanded ? <X className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );

  const grid = expanded && !pending && (
    <div className={`grid grid-cols-6 gap-1 p-2 ${target.pickerOnly ? "" : "border-t-2 border-[#EAF3F9]"}`} role="group" aria-label="Semua reaksi">
      {REACTIONS.map(({ key, label }, i) => (
        <button
          key={key}
          type="button"
          onClick={pick(() => onReact(key))}
          aria-label={label}
          aria-pressed={mineReacted.has(key)}
          title={label}
          style={{ animationDelay: `${i * 12}ms` }}
          className={`react-pop flex aspect-square items-center justify-center transition-transform duration-150 hover:scale-110 ${
            mineReacted.has(key) ? "bg-[#DCEBF5] shadow-[0_0_0_2px_#0369A1]" : "hover:bg-[#F0F7FB]"
          }`}
        >
          <Emoji name={key} size={30} />
        </button>
      ))}
    </div>
  );

  const list = !target.pickerOnly && (
    <ul className="border-t-2 border-[#EAF3F9] py-1">
      {actions.map(({ label, icon: Icon, run, danger }) => (
        <li key={label}>
          <button
            type="button"
            onClick={pick(run)}
            className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-medium transition-colors lg:min-h-10 lg:text-sm ${
              danger ? "text-[#BE123C] hover:bg-[#FFF1F2]" : "text-[#072033] hover:bg-[#F0F7FB]"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            {label}
          </button>
        </li>
      ))}
    </ul>
  );

  return createPortal(
    <div className="chat-ui fixed inset-0 z-[65]">
      <div
        className={`modal-backdrop absolute inset-0 ${sheet ? "bg-[#072033]/40 backdrop-blur-[2px]" : ""}`}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-hidden="true"
      />
      <FocusDialog
        open
        onClose={onClose}
        labelledBy="message-menu-title"
        className={
          sheet
            ? "sheet-up absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_0_0_#163A55,0_-6px_0_0_#0369A1]"
            : ""
        }
      >
        <div
          ref={panel}
          style={sheet ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_WIDTH, position: "fixed" }}
          className={sheet ? "" : "menu-pop origin-top bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]"}
        >
          <p id="message-menu-title" className="sr-only">
            Aksi pesan dari {message.author.display_name}
          </p>
          {sheet && (
            <div className="flex justify-center pt-2" aria-hidden="true">
              <span className="h-1 w-10 bg-[#CFE2EE]" />
            </div>
          )}
          {sheet && message.body && (
            <p className="mx-4 mt-2 line-clamp-2 border-l-[3px] border-[#0369A1] bg-[#F0F7FB] px-3 py-1.5 text-sm text-[#3B5A70]">
              {message.body}
            </p>
          )}
          {reactionBar}
          {grid}
          {list}
        </div>
      </FocusDialog>
    </div>,
    document.body
  );
}
