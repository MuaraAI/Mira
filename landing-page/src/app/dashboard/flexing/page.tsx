"use client";

import { useRef, useState } from "react";
import { Download, Share2, Eye, EyeOff } from "lucide-react";
import { toPng } from "html-to-image";
import { useApi } from "@/lib/api";
import {
  FORMATS,
  SITE,
  ShowcaseCard,
  buildShowcase,
  type ElearningGrades,
  type Format,
  type GradeItem,
  type KhsData,
  type KrsData,
  type StudentProfile,
  type Theme,
} from "@/components/ShowcaseCard";
import { ErrorState, LoadingState, PageHeader, ghostButtonClass, primaryButtonClass } from "@/components/dashboard-ui";

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-secondary">{label}</p>
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-10 flex-1 px-3 text-xs font-bold transition-colors ${
              value === option.value ? "bg-[#072033] text-white" : "px-frame bg-white text-foreground [--px-line:#CFE2EE] hover:text-[#0369A1]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FlexingPage() {
  const profile = useApi<StudentProfile>("/v1/studentv2/profile");
  const khs = useApi<KhsData>("/v1/studentv2/khs");
  const krs = useApi<KrsData>("/v1/studentv2/krs");
  const grades = useApi<GradeItem[]>("/v1/studentv2/grades");
  const elearning = useApi<ElearningGrades>("/v1/elearning/grades");

  const [theme, setTheme] = useState<Theme>("night");
  const [format, setFormat] = useState<Format>("post");
  const [hideNim, setHideNim] = useState(true);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  if (profile.loading && khs.loading) return <LoadingState label="Menyiapkan kartu flexing" />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.reload} />;

  const data = buildShowcase(profile.data, khs.data, krs.data, grades.data, elearning.data);
  const fileName = `mira-flexing-nilai-${format}.png`;

  const render = async () => {
    const node = cardRef.current?.querySelector<HTMLElement>(".flexcard-card");
    if (!node) throw new Error("Kartu belum siap");
    const { width, height } = FORMATS[format];
    return toPng(node, {
      width,
      height,
      pixelRatio: 1,
      cacheBust: true,
      style: { transform: "none" },
    });
  };

  const download = async () => {
    setBusy("download");
    setMessage(null);
    try {
      const url = await render();
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setMessage("Gambar tersimpan. Tinggal upload ke story atau LinkedIn kamu.");
    } catch {
      setMessage("Gagal membuat gambar. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    setMessage(null);
    try {
      const blob = await (await fetch(await render())).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Flexing Nilai di Mira", text: `Cek progres kuliahku di https://${SITE}` });
      } else {
        setMessage("Perangkat ini belum bisa bagikan langsung. Pakai tombol Unduh ya.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") setMessage("Gagal membagikan gambar. Coba Unduh saja.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flexing Nilai"
        description="Flexing progres kuliahmu: IPK, SKS, dan matkul terbaik dalam satu kartu. Siap diunduh buat story, feed, atau portofolio."
      />

      <div className="grid gap-8 lg:grid-cols-[auto_1fr]">
        <div ref={cardRef} className="mx-auto lg:mx-0">
          <ShowcaseCard data={data} theme={theme} format={format} hideNim={hideNim} />
        </div>

        <div className="glass-card h-fit space-y-5 p-5 sm:p-6 lg:max-w-sm">
          <OptionGroup
            label="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "night", label: "Malam" },
              { value: "mist", label: "Terang" },
            ]}
          />
          <OptionGroup
            label="Ukuran"
            value={format}
            onChange={setFormat}
            options={(Object.keys(FORMATS) as Format[]).map((key) => ({ value: key, label: FORMATS[key].label }))}
          />
          <button
            type="button"
            onClick={() => setHideNim((v) => !v)}
            aria-pressed={hideNim}
            className={`${ghostButtonClass} w-full`}
          >
            {hideNim ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {hideNim ? "NIM disamarkan" : "NIM ditampilkan"}
          </button>

          <div className="grid grid-cols-2 gap-3 border-t-2 border-px-soft pt-5">
            <button type="button" onClick={download} disabled={busy !== null} className={primaryButtonClass}>
              <Download className="h-4 w-4" />
              {busy === "download" ? "Membuat…" : "Unduh"}
            </button>
            <button type="button" onClick={share} disabled={busy !== null} className={ghostButtonClass}>
              <Share2 className="h-4 w-4" />
              {busy === "share" ? "Menyiapkan…" : "Bagikan"}
            </button>
          </div>
          {message && (
            <p className="text-sm text-secondary" role="status">
              {message}
            </p>
          )}
          <p className="text-xs leading-5 text-secondary">
            Semua dibuat di perangkatmu. Data nilai nggak dikirim ke mana-mana.
          </p>
        </div>
      </div>
    </div>
  );
}
