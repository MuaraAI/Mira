"use client";

export interface QuestionStatusItem {
  id: string;
  no: number;
  isAnswered: boolean;
  isRagu: boolean;
}

export interface CbtQuestionGridProps {
  total: number;
  currentIndex: number;
  items: QuestionStatusItem[];
  onSelectIndex: (index: number) => void;
}

export function CbtQuestionGrid({
  total,
  currentIndex,
  items,
  onSelectIndex,
}: CbtQuestionGridProps) {
  const answeredCount = items.filter((it) => it.isAnswered).length;
  const raguCount = items.filter((it) => it.isRagu).length;
  const unansweredCount = total - answeredCount;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
          Daftar Soal Ujian
        </h2>
        <span className="text-[11px] font-mono text-slate-700">
          {answeredCount}/{total} Terjawab
        </span>
      </div>

      {/* Grid Nomor Soal */}
      <div className="grid grid-cols-5 sm:grid-cols-5 gap-2 max-h-[55vh] overflow-y-auto p-0.5">
        {items.map((item, idx) => {
          const isCurrent = idx === currentIndex;

          let badgeStyle = "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100";
          if (item.isRagu) {
            badgeStyle = "bg-amber-400 text-slate-950 font-bold border-amber-500 hover:bg-amber-500";
          } else if (item.isAnswered) {
            badgeStyle = "bg-[#1980D4] text-white font-bold border-[#1569ad] hover:bg-[#146bb3]";
          }

          const currentRing = isCurrent
            ? "ring-2 ring-offset-2 ring-[#0369A1] scale-105 z-10"
            : "";

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectIndex(idx)}
              className={`min-w-[40px] min-h-[40px] rounded-md border flex items-center justify-center text-xs font-mono transition-all ${badgeStyle} ${currentRing}`}
              aria-label={`Pindah ke soal nomor ${item.no}`}
            >
              {item.no < 10 ? `0${item.no}` : item.no}
            </button>
          );
        })}
      </div>

      {/* Legend Keterangan */}
      <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-800 font-sans">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#1980D4] inline-block shrink-0" />
          <span>Sudah Dijawab ({answeredCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 inline-block shrink-0" />
          <span>Ragu-ragu ({raguCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-slate-50 border border-slate-300 inline-block shrink-0" />
          <span>Belum Dijawab ({unansweredCount})</span>
        </div>
      </div>
    </div>
  );
}
