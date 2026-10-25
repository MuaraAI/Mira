"use client";

import { useEffect, useState } from "react";
import {
  AtSign,
  Camera,
  ImagePlus,
  Bookmark,
  Compass,
  Copy,
  Crown,
  Globe2,
  Hash,
  Lock,
  MessagesSquare,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useDialog } from "@/components/ConfirmDialog";
import { SideSheet } from "@/components/SideSheet";
import { SheetTabs } from "@/components/SheetTabs";
import { ghostButtonClass, inputClass, primaryButtonClass } from "@/components/dashboard-ui";
import { Avatar, SpaceTile } from "@/components/social/Avatar";
import { useWallpaper, WALLPAPERS } from "@/lib/wallpaper";
import { MessageBody } from "@/components/social/MessageBody";
import {
  clockTime,
  compressImage,
  dayLabel,
  inviteLink,
  lastSeenLabel,
  mediaUrl,
  socialApi,
  toneFor,
  type Member,
  type Message,
  type SocialProfile,
  type SpaceItem,
  type SpaceRole,
} from "@/lib/social";

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.");

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[#3B5A70]">{hint}</span>}
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="border-l-[3px] border-[#BE123C] bg-[#FFF1F2] px-3 py-2 text-sm text-[#BE123C]">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ profile */

function ProfileForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial: { username: string; display_name: string; bio: string };
  submitLabel: string;
  onSaved: (profile: SocialProfile) => void;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { profile } = await socialApi.saveProfile(form);
      onSaved(profile);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nama tampilan">
        <input
          className={inputClass}
          value={form.display_name}
          maxLength={40}
          required
          data-autofocus
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          placeholder="Nama yang dilihat teman"
        />
      </Field>
      <Field label="Username" hint="3-24 karakter: huruf kecil, angka, garis bawah. Dipakai untuk @mention dan DM.">
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3B5A70]" aria-hidden="true" />
          <input
            className={`${inputClass} pl-9 font-mono`}
            value={form.username}
            maxLength={24}
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
            placeholder="nama_kamu"
          />
        </div>
      </Field>
      <Field label="Bio (opsional)">
        <textarea
          className={`${inputClass} min-h-20 resize-none`}
          value={form.bio}
          maxLength={160}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Contoh: Informatika 2023, suka ngoding malam"
        />
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={busy || form.username.length < 3 || !form.display_name.trim()} className={`${primaryButtonClass} w-full`}>
        {busy ? "Menyimpan..." : submitLabel}
      </button>
    </form>
  );
}

export function Onboarding({ suggestedName, onDone }: { suggestedName: string; onDone: (profile: SocialProfile) => void }) {
  const firstName = suggestedName.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") ?? "";
  const features = [
    { icon: MessagesSquare, title: "Chat pribadi", text: "DM teman sekelas, lengkap dengan tanda dibaca dan Pesan Tersimpan." },
    { icon: Hash, title: "Ruang & channel", text: "Bikin ruang kelas atau organisasi, pisahkan obrolan per channel." },
    { icon: Users, title: "Ringan & realtime", text: "Pesan langsung masuk tanpa reload, hemat kuota dan baterai." },
  ];
  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-2 lg:grid-cols-[1.1fr_1fr] lg:py-6">
      <div>
        <p className="section-kicker">Mira Komunitas</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#072033] sm:text-4xl">Ngobrol bareng teman kampus.</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[#3B5A70]">
          Gabungan yang enak dari Discord dan Telegram: ruang dengan channel untuk kelas dan organisasi, plus chat pribadi yang
          cepat dan rapi. NIM kamu tidak pernah ditampilkan ke pengguna lain.
        </p>
        <ul className="mt-6 space-y-3">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="px-icon h-10 w-10 shrink-0">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#072033]">{title}</span>
                <span className="block text-sm text-[#3B5A70]">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-card bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-[#072033]">Buat profil kamu</h2>
        <p className="mb-5 mt-1 text-sm text-[#3B5A70]">Bisa diubah kapan saja.</p>
        <ProfileForm
          initial={{ username: firstName.slice(0, 24), display_name: suggestedName.slice(0, 40), bio: "" }}
          submitLabel="Mulai ngobrol"
          onSaved={onDone}
        />
      </div>
    </div>
  );
}

/** Pilih gambar, kompres di perangkat, unggah, lalu kembalikan id media. */
function ImagePickButton({
  kind,
  label,
  onUploaded,
  className = "",
  children,
}: {
  kind: "avatar" | "banner";
  label: string;
  onUploaded: (id: string) => Promise<void> | void;
  className?: string;
  children: React.ReactNode;
}) {
  const { notify } = useDialog();
  const [busy, setBusy] = useState(false);
  return (
    // Posisi (absolute) datang dari `className`; jangan tambahkan `relative` di sini karena akan menimpanya.
    <label className={`cursor-pointer ${busy ? "pointer-events-none opacity-70" : ""} ${className}`} aria-label={label} title={label}>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const blob = await compressImage(file, kind);
            const { id } = await socialApi.uploadMedia(blob, kind);
            await onUploaded(id);
          } catch (err) {
            notify(err instanceof Error && err.message ? err.message : "Gagal mengunggah gambar", "error");
          } finally {
            setBusy(false);
          }
        }}
      />
      {children}
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-[#072033]/40 text-xs font-bold text-white">Mengunggah...</span>
      )}
    </label>
  );
}

/** Kepala profil ala Discord: banner, avatar menumpang di tepinya, nama, dan status. */
function ProfileHeader({
  name,
  username,
  avatar,
  banner,
  seed,
  online,
  status,
  editBanner,
  editAvatar,
}: {
  name: string;
  username?: string;
  avatar: string | null;
  banner: string | null;
  seed: string;
  online?: boolean;
  status?: string;
  editBanner?: React.ReactNode;
  editAvatar?: React.ReactNode;
}) {
  const bannerUrl = mediaUrl(banner);
  const tone = toneFor(seed);
  return (
    <div className="-mx-4 -mt-4 mb-4 sm:-mx-6 sm:-mt-6">
      <div
        className="relative h-28 bg-cover bg-center sm:h-32"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: `repeating-linear-gradient(135deg, ${tone.bg} 0 12px, ${tone.bg}e6 12px 24px)` }}
      >
        {editBanner}
      </div>
      <div className="flex items-end gap-3 px-4 sm:px-6">
        <div className="relative -mt-10 shadow-[0_0_0_4px_#fff]">
          <Avatar name={name} seed={seed} src={avatar} size="xl" online={online} />
          {editAvatar}
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="truncate text-lg font-bold leading-tight text-[#072033]">{name}</p>
          {username && <p className="truncate text-[13px] text-[#3B5A70]">@{username}</p>}
        </div>
      </div>
      {status && (
        <p className={`mt-2 flex items-center gap-1.5 px-4 text-[13px] sm:px-6 ${online ? "font-medium text-[#15803D]" : "text-[#3B5A70]"}`}>
          {online && <span className="h-2 w-2 bg-[#16A34A]" aria-hidden="true" />}
          {status}
        </p>
      )}
    </div>
  );
}

export function ProfileCard({ open, profile, onClose }: { open: boolean; profile: SocialProfile; onClose: () => void }) {
  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Profil" title={profile.display_name} titleId="social-card-title" width="md">
      <ProfileHeader
        name={profile.display_name}
        username={profile.username}
        avatar={profile.avatar}
        banner={profile.banner}
        seed={profile.username}
        online={profile.online}
        status={lastSeenLabel(profile)}
      />
      <section>
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">Bio</h4>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#072033]">{profile.bio || "Belum menulis bio."}</p>
      </section>
    </SideSheet>
  );
}

const editBadge = "absolute flex h-9 w-9 items-center justify-center bg-white text-[#072033] shadow-[0_0_0_2px_#163A55,2px_2px_0_0_#0369A1] hover:bg-[#EAF3F9]";

export function ProfileSheet({
  open,
  me,
  onClose,
  onSaved,
}: {
  open: boolean;
  me: SocialProfile;
  onClose: () => void;
  onSaved: (profile: SocialProfile, close?: boolean) => void;
}) {
  const { notify } = useDialog();
  const wallpaper = useWallpaper();
  const setMedia = async (changes: { avatar?: string | null; banner?: string | null }) => {
    const { profile } = await socialApi.setMyMedia(changes);
    onSaved(profile, false);
    notify("Profil diperbarui", "success");
  };
  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Komunitas" title="Profil kamu" titleId="social-profile-title" width="md">
      <ProfileHeader
        name={me.display_name}
        username={me.username}
        avatar={me.avatar}
        banner={me.banner}
        seed={me.username}
        editBanner={
          <ImagePickButton kind="banner" label="Ganti banner" onUploaded={(id) => setMedia({ banner: id })} className={`${editBadge} bottom-2 right-2`}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
          </ImagePickButton>
        }
        editAvatar={
          <ImagePickButton kind="avatar" label="Ganti foto profil" onUploaded={(id) => setMedia({ avatar: id })} className={`${editBadge} -bottom-2 -right-2 h-8 w-8`}>
            <Camera className="h-4 w-4" aria-hidden="true" />
          </ImagePickButton>
        }
      />
      {(me.avatar || me.banner) && (
        <div className="-mt-1 mb-4 flex flex-wrap gap-3 text-[13px]">
          {me.avatar && (
            <button type="button" onClick={() => setMedia({ avatar: null })} className="font-semibold text-[#BE123C] hover:underline">
              Hapus foto profil
            </button>
          )}
          {me.banner && (
            <button type="button" onClick={() => setMedia({ banner: null })} className="font-semibold text-[#BE123C] hover:underline">
              Hapus banner
            </button>
          )}
        </div>
      )}
      <ProfileForm initial={me} submitLabel="Simpan profil" onSaved={(p) => onSaved(p, true)} />

      <section className="mt-6 border-t-2 border-dashed border-[#CFE2EE] pt-5">
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">Wallpaper chat</h4>
        <p className="mb-3 text-[13px] text-[#3B5A70]">Tersimpan di perangkat ini saja.</p>
        <div className="grid grid-cols-4 gap-2">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => wallpaper.choose(w.id)}
              aria-pressed={wallpaper.stored.id === w.id}
              className={`flex aspect-[3/4] flex-col justify-end p-1 text-[11px] font-semibold text-[#072033] transition-shadow ${
                wallpaper.stored.id === w.id ? "shadow-[0_0_0_3px_#0369A1]" : "shadow-[0_0_0_2px_#CFE2EE] hover:shadow-[0_0_0_2px_#5FA3CC]"
              }`}
              style={w.style}
            >
              <span className="bg-white/90 px-1 py-0.5">{w.label}</span>
            </button>
          ))}
          <label
            className={`flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 bg-[#F0F7FB] p-1 text-center text-[11px] font-semibold text-[#0369A1] transition-shadow ${
              wallpaper.stored.id === "custom" ? "shadow-[0_0_0_3px_#0369A1]" : "shadow-[0_0_0_2px_#CFE2EE] hover:shadow-[0_0_0_2px_#5FA3CC]"
            }`}
            style={wallpaper.stored.id === "custom" ? wallpaper.style : undefined}
          >
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  await wallpaper.setCustom(file);
                } catch (err) {
                  notify(err instanceof Error ? err.message : "Gagal memasang wallpaper", "error");
                }
              }}
            />
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            <span className="bg-white/90 px-1 py-0.5">Gambar sendiri</span>
          </label>
        </div>
      </section>
    </SideSheet>
  );
}

/* ------------------------------------------------------------------ spaces */

export function CreateSpaceSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (space: SpaceItem) => void;
}) {
  const [form, setForm] = useState({ name: "", description: "", is_public: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { space } = await socialApi.createSpace(form);
      setForm({ name: "", description: "", is_public: false });
      onCreated(space);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Ruang baru" title="Buat ruang" subtitle="Untuk kelas, kelompok tugas, UKM, atau angkatan." titleId="social-create-title" width="md">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama ruang">
          <input className={inputClass} data-autofocus required minLength={2} maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Kelas 15.4A.07" />
        </Field>
        <Field label="Deskripsi (opsional)">
          <textarea className={`${inputClass} min-h-20 resize-none`} maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ruang ini untuk apa?" />
        </Field>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">Visibilitas</legend>
          {[
            { value: false, icon: Lock, title: "Privat", text: "Hanya lewat link undangan" },
            { value: true, icon: Globe2, title: "Publik", text: "Bisa ditemukan di Jelajahi" },
          ].map(({ value, icon: Icon, title, text }) => (
            <label
              key={title}
              className={`flex cursor-pointer items-start gap-2.5 p-3 transition-colors ${
                form.is_public === value ? "bg-[#DCEBF5] shadow-[0_0_0_2px_#0369A1]" : "bg-white shadow-[0_0_0_2px_#CFE2EE] hover:shadow-[0_0_0_2px_#5FA3CC]"
              }`}
            >
              <input type="radio" name="visibility" className="sr-only" checked={form.is_public === value} onChange={() => setForm({ ...form, is_public: value })} />
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
              <span>
                <span className="block text-sm font-bold text-[#072033]">{title}</span>
                <span className="block text-xs text-[#3B5A70]">{text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <FormError message={error} />
        <button type="submit" disabled={busy || form.name.trim().length < 2} className={`${primaryButtonClass} w-full`}>
          {busy ? "Membuat..." : "Buat ruang"}
        </button>
      </form>
    </SideSheet>
  );
}

export function JoinSheet({
  open,
  initialCode,
  onClose,
  onJoined,
}: {
  open: boolean;
  initialCode: string;
  onClose: () => void;
  onJoined: (space: SpaceItem) => void;
}) {
  const [tab, setTab] = useState<"invite" | "discover">(initialCode ? "invite" : "discover");
  const [code, setCode] = useState(initialCode);
  const [query, setQuery] = useState("");
  const [spaces, setSpaces] = useState<SpaceItem[] | null>(null);
  const [busy, setBusy] = useState<number | "code" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setTab("invite");
    }
  }, [initialCode]);

  useEffect(() => {
    if (!open || tab !== "discover") return;
    const timer = setTimeout(() => {
      socialApi.discover(query).then((r) => setSpaces(r.spaces)).catch(() => setSpaces([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, tab, query]);

  const join = async (target: number | "code") => {
    setBusy(target);
    setError(null);
    try {
      const { space } = target === "code" ? await socialApi.joinByInvite(code.trim()) : await socialApi.joinPublic(target);
      onJoined(space);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Ruang" title="Gabung ruang" titleId="social-join-title" width="md" flush>
      <SheetTabs
        label="Cara bergabung"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "discover", label: "Jelajahi" },
          { key: "invite", label: "Kode undangan" },
        ]}
      />
      <div className="space-y-4 p-4 sm:p-6">
        {tab === "invite" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              join("code");
            }}
            className="space-y-4"
          >
            <Field label="Link atau kode undangan" hint="Minta link undangan ke admin ruang.">
              <input className={`${inputClass} font-mono`} data-autofocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="https://.../komunitas?join=AbCd123XyZ" />
            </Field>
            <FormError message={error} />
            <button type="submit" disabled={busy !== null || code.trim().length < 4} className={`${primaryButtonClass} w-full`}>
              {busy === "code" ? "Bergabung..." : "Gabung"}
            </button>
          </form>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3B5A70]" aria-hidden="true" />
              <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari ruang publik" aria-label="Cari ruang publik" />
            </div>
            <FormError message={error} />
            {spaces === null ? (
              <p className="py-6 text-center font-mono text-xs text-[#3B5A70]">Memuat ruang publik...</p>
            ) : spaces.length === 0 ? (
              <div className="py-8 text-center">
                <Compass className="mx-auto h-8 w-8 text-[#9CC6E0]" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-[#072033]">Belum ada ruang publik</p>
                <p className="text-xs text-[#3B5A70]">Jadilah yang pertama membuat ruang publik.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {spaces.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 bg-white p-3 shadow-[0_0_0_2px_#CFE2EE]">
                    <SpaceTile name={s.name} src={s.avatar} active={false} compact />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#072033]">{s.name}</p>
                      <p className="truncate text-xs text-[#3B5A70]">{s.description || "Tanpa deskripsi"}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#3B5A70]">{s.member_count} anggota</p>
                    </div>
                    {s.my_role ? (
                      <span className="px-chip bg-[#F0F7FB] px-2 py-1 font-mono text-[10px] font-bold text-[#0F766E]">Anggota</span>
                    ) : (
                      <button type="button" onClick={() => join(s.id)} disabled={busy !== null} className={`${ghostButtonClass} min-h-9 px-3 text-xs`}>
                        {busy === s.id ? "..." : "Gabung"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SideSheet>
  );
}

/* ------------------------------------------------------------------ direct messages */

export function NewDmSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (username: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.replace(/^@/, "").length < 2) {
      setUsers([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      socialApi
        .searchUsers(q)
        .then((r) => setUsers(r.users))
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Pesan" title="Chat baru" subtitle="Cari teman lewat nama atau @username." titleId="social-newdm-title" width="md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3B5A70]" aria-hidden="true" />
        <input className={`${inputClass} pl-9`} data-autofocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="@username atau nama" aria-label="Cari pengguna" />
      </div>
      <button type="button" onClick={() => onPick("__saved__")} className="mt-4 flex w-full items-center gap-3 p-2 text-left hover:bg-[#F0F7FB]">
        <Avatar name="Pesan Tersimpan" seed="saved" saved />
        <span>
          <span className="block text-sm font-bold text-[#072033]">Pesan Tersimpan</span>
          <span className="block text-xs text-[#3B5A70]">Catatan pribadi, link, dan pengingat untuk diri sendiri</span>
        </span>
      </button>
      <ul className="mt-2 space-y-1">
        {users.map((u) => (
          <li key={u.username}>
            <button type="button" onClick={() => onPick(u.username)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-[#F0F7FB]">
              <Avatar name={u.display_name} seed={u.username} src={u.avatar} online={u.online} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[#072033]">{u.display_name}</span>
                <span className="block truncate font-mono text-[11px] text-[#3B5A70]">
                  @{u.username} · {lastSeenLabel(u)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {query.trim().length >= 2 && !loading && users.length === 0 && (
        <p className="py-6 text-center text-sm text-[#3B5A70]">Tidak ada pengguna yang cocok.</p>
      )}
    </SideSheet>
  );
}

/* ------------------------------------------------------------------ members */

const ROLE_META: Record<SpaceRole, { label: string; icon: typeof Crown; className: string }> = {
  owner: { label: "Pemilik", icon: Crown, className: "text-[#9A3412]" },
  admin: { label: "Admin", icon: Shield, className: "text-[#0369A1]" },
  member: { label: "Anggota", icon: Users, className: "text-[#3B5A70]" },
};

export function MemberList({
  members,
  me,
  myRole,
  onMessage,
  onRole,
  onKick,
}: {
  members: Member[];
  me: string;
  myRole: SpaceRole | null;
  onMessage: (username: string) => void;
  onRole?: (member: Member, role: SpaceRole) => void;
  onKick?: (member: Member) => void;
}) {
  const groups = (["owner", "admin", "member"] as SpaceRole[])
    .map((role) => ({ role, items: members.filter((m) => m.role === role) }))
    .filter((g) => g.items.length);
  const rank = { owner: 3, admin: 2, member: 1 };
  return (
    <div className="space-y-4">
      {groups.map(({ role, items }) => (
        <section key={role}>
          <h4 className="mb-1 px-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#3B5A70]">
            {ROLE_META[role].label} · {items.length}
          </h4>
          <ul className="space-y-0.5">
            {items.map((m) => {
              const RoleIcon = ROLE_META[m.role].icon;
              const manageable = !!myRole && m.username !== me && rank[myRole] > rank[m.role];
              return (
                <li key={m.username} className="group flex items-center gap-2.5 px-1 py-1.5 hover:bg-[#F0F7FB]">
                  <button type="button" onClick={() => m.username !== me && onMessage(m.username)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title={m.username === me ? "Kamu" : `Kirim pesan ke ${m.display_name}`}>
                    <Avatar name={m.display_name} seed={m.username} src={m.avatar} size="sm" online={m.online} />
                    <span className="min-w-0">
                      <span className={`flex items-center gap-1 truncate text-sm font-semibold ${m.online ? "text-[#072033]" : "text-[#3B5A70]"}`}>
                        <span className="truncate">{m.display_name}</span>
                        {m.role !== "member" && <RoleIcon className={`h-3.5 w-3.5 shrink-0 ${ROLE_META[m.role].className}`} aria-label={ROLE_META[m.role].label} />}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-[#3B5A70]">@{m.username}</span>
                    </span>
                  </button>
                  {manageable && onRole && onKick && (
                    <span className="flex shrink-0 gap-1">
                      {myRole === "owner" && (
                        <button
                          type="button"
                          onClick={() => onRole(m, m.role === "admin" ? "member" : "admin")}
                          title={m.role === "admin" ? "Jadikan anggota" : "Jadikan admin"}
                          aria-label={m.role === "admin" ? `Jadikan ${m.display_name} anggota` : `Jadikan ${m.display_name} admin`}
                          className="flex h-8 w-8 items-center justify-center bg-white text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE] hover:bg-[#EAF3F9]"
                        >
                          <Shield className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onKick(m)}
                        title="Keluarkan"
                        aria-label={`Keluarkan ${m.display_name}`}
                        className="flex h-8 w-8 items-center justify-center bg-white text-[#BE123C] shadow-[0_0_0_2px_#FDA4AF] hover:bg-[#FFF1F2]"
                      >
                        <UserMinus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ space settings */

export function SpaceSettingsSheet({
  open,
  space,
  me,
  members,
  onClose,
  onChanged,
  onLeft,
  onMessage,
  reloadMembers,
}: {
  open: boolean;
  space: SpaceItem;
  me: string;
  members: Member[];
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
  onMessage: (username: string) => void;
  reloadMembers: () => void;
}) {
  const { confirm, notify } = useDialog();
  const isAdmin = space.my_role === "owner" || space.my_role === "admin";
  const [tab, setTab] = useState<"umum" | "channel" | "anggota">("umum");
  const [form, setForm] = useState({ name: space.name, description: space.description, is_public: space.is_public });
  const [channel, setChannel] = useState({ name: "", topic: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ name: space.name, description: space.description, is_public: space.is_public });
  }, [space.name, space.description, space.is_public]);

  const guard = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (success) notify(success, "success");
      onChanged();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!space.invite_code) return;
    try {
      await navigator.clipboard.writeText(inviteLink(space.invite_code));
      notify("Link undangan disalin", "success");
    } catch {
      notify("Gagal menyalin. Salin manual dari kolom link.", "error");
    }
  };

  const tabs = [
    { key: "umum" as const, label: "Umum" },
    ...(isAdmin ? [{ key: "channel" as const, label: "Channel" }] : []),
    { key: "anggota" as const, label: `Anggota (${space.member_count})` },
  ];

  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Pengaturan ruang" title={space.name} titleId="social-space-title" width="md" flush>
      <SheetTabs label="Bagian pengaturan" value={tab} onChange={setTab} tabs={tabs} />
      <div className="space-y-5 p-4 sm:p-6">
        <FormError message={error} />

        {tab === "umum" && (
          <>
            <ProfileHeader
              name={space.name}
              avatar={space.avatar}
              banner={space.banner}
              seed={`space-${space.id}`}
              status={`${space.member_count} anggota · ${space.is_public ? "Ruang publik" : "Ruang privat"}`}
              editBanner={
                isAdmin && (
                  <ImagePickButton
                    kind="banner"
                    label="Ganti banner grup"
                    onUploaded={(id) => guard(() => socialApi.setSpaceMedia(space.id, { banner: id }), "Banner grup diperbarui").then(() => undefined)}
                    className={`${editBadge} bottom-2 right-2`}
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  </ImagePickButton>
                )
              }
              editAvatar={
                isAdmin && (
                  <ImagePickButton
                    kind="avatar"
                    label="Ganti foto grup"
                    onUploaded={(id) => guard(() => socialApi.setSpaceMedia(space.id, { avatar: id }), "Foto grup diperbarui").then(() => undefined)}
                    className={`${editBadge} -bottom-2 -right-2 h-8 w-8`}
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                  </ImagePickButton>
                )
              }
            />
            {space.invite_code && (
              <section className="space-y-2">
                <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B5A70]">Link undangan</h4>
                <div className="flex gap-2">
                  <input readOnly value={inviteLink(space.invite_code)} className={`${inputClass} font-mono text-xs`} aria-label="Link undangan" onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={copyInvite} className={`${ghostButtonClass} shrink-0 px-3`} aria-label="Salin link undangan">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (await confirm({ title: "Ganti link undangan?", message: "Link lama langsung tidak berlaku lagi.", confirmLabel: "Ganti link" })) {
                        guard(() => socialApi.resetInvite(space.id), "Link undangan baru dibuat");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#0369A1] hover:text-[#075985]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Buat link baru
                  </button>
                )}
              </section>
            )}

            {isAdmin ? (
              <form
                className="space-y-4 border-t-2 border-dashed border-[#CFE2EE] pt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  guard(() => socialApi.updateSpace(space.id, form), "Ruang diperbarui");
                }}
              >
                <Field label="Nama ruang">
                  <input className={inputClass} minLength={2} maxLength={40} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Deskripsi">
                  <textarea className={`${inputClass} min-h-20 resize-none`} maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="h-5 w-5 accent-[#0369A1]" />
                  <span className="text-sm text-[#072033]">Tampilkan di Jelajahi (ruang publik)</span>
                </label>
                <button type="submit" disabled={busy} className={primaryButtonClass}>
                  Simpan
                </button>
              </form>
            ) : (
              <p className="text-sm text-[#3B5A70]">{space.description || "Ruang ini belum punya deskripsi."}</p>
            )}

            <section className="border-t-2 border-dashed border-[#CFE2EE] pt-5">
              {space.my_role === "owner" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="px-btn-danger inline-flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-white"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Hapus ${space.name}?`,
                      message: "Semua channel dan pesan di ruang ini terhapus permanen untuk semua anggota.",
                      confirmLabel: "Hapus ruang",
                      tone: "danger",
                    });
                    if (ok && (await guard(() => socialApi.deleteSpace(space.id), "Ruang dihapus"))) onLeft();
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus ruang
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className={`${ghostButtonClass} px-btn-ghost-danger`}
                  onClick={async () => {
                    const ok = await confirm({ title: `Keluar dari ${space.name}?`, message: "Kamu bisa bergabung lagi lewat link undangan.", confirmLabel: "Keluar", tone: "danger" });
                    if (ok && (await guard(() => socialApi.leaveSpace(space.id)))) onLeft();
                  }}
                >
                  Keluar dari ruang
                </button>
              )}
            </section>
          </>
        )}

        {tab === "channel" && isAdmin && (
          <>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await guard(() => socialApi.createChannel(space.id, channel), "Channel dibuat")) setChannel({ name: "", topic: "" });
              }}
            >
              <Field label="Channel baru" hint="Huruf kecil dan tanda hubung, contoh: tugas-kelompok">
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3B5A70]" aria-hidden="true" />
                  <input className={`${inputClass} pl-9 font-mono`} maxLength={32} required value={channel.name} onChange={(e) => setChannel({ ...channel, name: e.target.value })} placeholder="nama-channel" />
                </div>
              </Field>
              <input className={inputClass} maxLength={120} value={channel.topic} onChange={(e) => setChannel({ ...channel, topic: e.target.value })} placeholder="Topik (opsional)" aria-label="Topik channel" />
              <button type="submit" disabled={busy || !channel.name.trim()} className={primaryButtonClass}>
                Tambah channel
              </button>
            </form>
            <ul className="space-y-1.5 border-t-2 border-dashed border-[#CFE2EE] pt-4">
              {space.channels.map((c) => (
                <li key={c.id} className="flex items-center gap-2 bg-white px-3 py-2 shadow-[0_0_0_2px_#CFE2EE]">
                  <Hash className="h-4 w-4 shrink-0 text-[#3B5A70]" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-semibold text-[#072033]">{c.name}</span>
                    {c.topic && <span className="block truncate text-xs text-[#3B5A70]">{c.topic}</span>}
                  </span>
                  <button
                    type="button"
                    disabled={busy || space.channels.length <= 1}
                    aria-label={`Hapus channel ${c.name}`}
                    title={space.channels.length <= 1 ? "Ruang wajib punya minimal satu channel" : "Hapus channel"}
                    onClick={async () => {
                      const ok = await confirm({ title: `Hapus #${c.name}?`, message: "Semua pesan di channel ini ikut terhapus.", confirmLabel: "Hapus", tone: "danger" });
                      if (ok) guard(() => socialApi.deleteChannel(c.id), "Channel dihapus");
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-[#BE123C] hover:bg-[#FFF1F2] disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "anggota" && (
          <MemberList
            members={members}
            me={me}
            myRole={space.my_role}
            onMessage={(u) => {
              onClose();
              onMessage(u);
            }}
            onRole={(m, role) => guard(() => socialApi.setRole(space.id, m.username, role), `${m.display_name} sekarang ${ROLE_META[role].label.toLowerCase()}`).then(reloadMembers)}
            onKick={async (m) => {
              const ok = await confirm({ title: `Keluarkan ${m.display_name}?`, message: "Dia bisa bergabung lagi kalau punya link undangan.", confirmLabel: "Keluarkan", tone: "danger" });
              if (ok) guard(() => socialApi.kick(space.id, m.username), `${m.display_name} dikeluarkan`).then(reloadMembers);
            }}
          />
        )}
      </div>
    </SideSheet>
  );
}

/* ------------------------------------------------------------------ pins & search */

function MessageResult({ message, me, onPick }: { message: Message; me: string; onPick: (m: Message) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(message)} className="flex w-full gap-2.5 bg-white p-3 text-left shadow-[0_0_0_2px_#CFE2EE] hover:shadow-[0_0_0_2px_#5FA3CC]">
        <Avatar name={message.author.display_name} seed={message.author.username} src={message.author.avatar} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold text-[#072033]">{message.author.display_name}</span>
            <span className="shrink-0 font-mono text-[10px] text-[#3B5A70]">
              {dayLabel(message.created_at)} {clockTime(message.created_at)}
            </span>
          </span>
          <span className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-sm text-[#072033] [overflow-wrap:anywhere]">
            <MessageBody text={message.body} me={me} />
          </span>
        </span>
      </button>
    </li>
  );
}

export function PinsSheet({
  open,
  conversationId,
  me,
  onClose,
  onPick,
}: {
  open: boolean;
  conversationId: number;
  me: string;
  onClose: () => void;
  onPick: (m: Message) => void;
}) {
  const [pins, setPins] = useState<Message[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setPins(null);
    socialApi.pins(conversationId).then((r) => setPins(r.messages)).catch(() => setPins([]));
  }, [open, conversationId]);
  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Percakapan" title="Pesan disematkan" titleId="social-pins-title" width="md">
      {pins === null ? (
        <p className="py-6 text-center font-mono text-xs text-[#3B5A70]">Memuat...</p>
      ) : pins.length === 0 ? (
        <div className="py-8 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-[#9CC6E0]" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-[#072033]">Belum ada pesan disematkan</p>
          <p className="text-xs text-[#3B5A70]">Sematkan info penting seperti link grup tugas atau jadwal kumpul.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pins.map((m) => (
            <MessageResult key={m.id} message={m} me={me} onPick={onPick} />
          ))}
        </ul>
      )}
    </SideSheet>
  );
}

export function SearchSheet({
  open,
  conversationId,
  me,
  onClose,
  onPick,
}: {
  open: boolean;
  conversationId: number;
  me: string;
  onClose: () => void;
  onPick: (m: Message) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[] | null>(null);
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      socialApi.search(conversationId, query.trim()).then((r) => setResults(r.messages)).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, query, conversationId]);
  return (
    <SideSheet open={open} onClose={onClose} eyebrow="Percakapan" title="Cari pesan" titleId="social-search-title" width="md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3B5A70]" aria-hidden="true" />
        <input className={`${inputClass} pl-9`} data-autofocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kata kunci" aria-label="Kata kunci pencarian" />
      </div>
      {results !== null && (
        <>
          <p className="mb-2 mt-4 font-mono text-[11px] text-[#3B5A70]">{results.length} hasil</p>
          <ul className="space-y-2">
            {results.map((m) => (
              <MessageResult key={m.id} message={m} me={me} onPick={onPick} />
            ))}
          </ul>
        </>
      )}
    </SideSheet>
  );
}
