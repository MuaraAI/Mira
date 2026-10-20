"use client";

import { useState } from "react";
import {
  MessageSquare,
  Clock,
  User,
  Send,
  Plus,
  X,
  MessageCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiFetch, useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  inputClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/dashboard-ui";
import { CourseSelect } from "@/components/CourseSelect";

interface CourseItem {
  id: string;
  kode?: string;
  nama: string;
  kode_dosen?: string;
  token_diskusi?: string | null;
  tokens?: {
    diskusi?: string | null;
  };
}

interface DiscussionThread {
  id_chat: string | null;
  judul: string;
  isi: string;
  penulis: string;
  tanggal: string;
  token_komentar: string | null;
  total_komentar: number;
}

interface DiscussionsData {
  meta?: {
    kd_lokal?: string;
    kd_mtk?: string;
  };
  threads: DiscussionThread[];
}

interface DiscussionComment {
  nim?: string | null;
  nama?: string | null;
  komentar: string;
  tanggal?: string;
  is_self?: boolean;
}

export default function DiskusiPage() {
  const coursesApi = useApi<CourseItem[]>("/v1/elearning/courses");
  const [selectedCourseIdx, setSelectedCourseIdx] = useState(0);

  const courses = coursesApi.data ?? [];
  const activeCourse = courses.length > 0 ? courses[selectedCourseIdx] : null;
  const tokenDiskusi = activeCourse?.token_diskusi || activeCourse?.tokens?.diskusi;

  // State discussions
  const discussionsApi = useApi<DiscussionsData>(
    tokenDiskusi ? `/v1/elearning/discussions?token=${encodeURIComponent(tokenDiskusi)}` : ""
  );

  // State thread yang sedang dibuka komentarnya
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [activeTokenKomentar, setActiveTokenKomentar] = useState<string | null>(null);

  // State komentar thread aktif
  const commentsApi = useApi<DiscussionComment[]>(
    activeTokenKomentar
      ? `/v1/elearning/discussions/comments?token=${encodeURIComponent(activeTokenKomentar)}`
      : ""
  );

  // State input balas komentar
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  // State modal buat topik baru
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (coursesApi.loading) {
    return <LoadingState label="Memuat daftar mata kuliah forum diskusi" />;
  }
  if (coursesApi.error) {
    return <ErrorState error={coursesApi.error} onRetry={coursesApi.reload} />;
  }

  function handleToggleComments(thread: DiscussionThread) {
    if (expandedThreadId === thread.id_chat) {
      setExpandedThreadId(null);
      setActiveTokenKomentar(null);
    } else {
      setExpandedThreadId(thread.id_chat);
      setActiveTokenKomentar(thread.token_komentar);
      setReplyText("");
      setReplyError(null);
      setReplySuccess(null);
    }
  }

  async function handleSendReply(e: React.FormEvent, thread: DiscussionThread) {
    e.preventDefault();
    if (!activeTokenKomentar || !thread.id_chat) return;

    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyError("Isi tanggapan komentar tidak boleh kosong.");
      return;
    }

    setSubmittingReply(true);
    setReplyError(null);
    setReplySuccess(null);

    try {
      await apiFetch("/v1/elearning/discussions/comments", {
        method: "POST",
        json: {
          token_komentar: activeTokenKomentar,
          id_chat: thread.id_chat,
          komentar: trimmed,
        },
      });

      setReplyText("");
      setReplySuccess("Tanggapan berhasil dikirimkan ke forum MyBest!");
      commentsApi.reload();
      discussionsApi.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirimkan komentar ke MyBest.";
      setReplyError(msg);
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenDiskusi) return;

    if (!newTitle.trim() || !newContent.trim()) {
      setCreateError("Judul dan isi topik diskusi wajib diisi.");
      return;
    }

    setCreatingTopic(true);
    setCreateError(null);

    try {
      await apiFetch("/v1/elearning/discussions", {
        method: "POST",
        json: {
          token_course: tokenDiskusi,
          judul: newTitle.trim(),
          chat: newContent.trim(),
        },
      });

      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewContent("");
      discussionsApi.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat topik diskusi di MyBest.";
      setCreateError(msg);
    } finally {
      setCreatingTopic(false);
    }
  }

  const threads = discussionsApi.data?.threads ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Forum Diskusi Perkuliahan"
          description="Ruang tanya jawab, diskusi tugas kelompok, dan arahan instruksi dosen per mata kuliah di MyBest."
        />

        {tokenDiskusi && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className={`${primaryButtonClass} text-xs py-2 self-start sm:self-auto`}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Buat Topik Diskusi</span>
          </button>
        )}
      </div>

      {/* Course Selector */}
      <CourseSelect
        options={courses.map((course, idx) => ({ key: String(idx), label: course.nama }))}
        value={String(selectedCourseIdx)}
        onChange={(key) => {
          setSelectedCourseIdx(Number(key));
          setExpandedThreadId(null);
          setActiveTokenKomentar(null);
        }}
      />

      {/* Main Content Area */}
      {!tokenDiskusi ? (
        <EmptyState
          title="Forum diskusi belum tersedia untuk mata kuliah ini."
          description="Dosen pengampu belum membuka akses link form diskusi pada portal MyBest."
        />
      ) : discussionsApi.loading ? (
        <LoadingState label="Memuat topik forum diskusi perkuliahan" />
      ) : discussionsApi.error ? (
        <ErrorState error={discussionsApi.error} onRetry={discussionsApi.reload} />
      ) : threads.length === 0 ? (
        <EmptyState
          title="Belum ada topik diskusi pada mata kuliah ini."
          description="Klik 'Buat Topik Diskusi' untuk memulai ruang tanya jawab baru bersama dosen dan teman sekelas."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-secondary font-mono">
            <span>Mata Kuliah: {activeCourse?.nama}</span>
            <span>{threads.length} Topik Diskusi Aktif</span>
          </div>

          {threads.map((thread) => {
            const isExpanded = expandedThreadId === thread.id_chat;

            return (
              <div
                key={thread.id_chat || thread.judul}
                className="glass-card overflow-hidden border-l-4 border-l-[#0369A1] transition-all"
              >
                {/* Thread Header & Question Card */}
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold bg-[#F0F7FB] text-[#0369A1] border border-stroke font-mono">
                        <User className="w-3 h-3" />
                        {thread.penulis || "Dosen Pengampu"}
                      </span>
                      {thread.tanggal && (
                        <span className="text-[11px] text-secondary flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {thread.tanggal}
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold bg-[#F0F7FB] text-[#0F766E] border border-[#0F766E]/20">
                      <MessageCircle className="w-3 h-3" />
                      {thread.total_komentar} Balasan
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
                    {thread.judul}
                  </h3>

                  <p className="text-xs sm:text-sm text-secondary leading-relaxed whitespace-pre-wrap bg-[#F7FAFC] p-3.5 rounded-md border border-stroke/70">
                    {thread.isi}
                  </p>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleToggleComments(thread)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-stroke bg-white hover:bg-[#F0F7FB] text-xs font-semibold text-[#0369A1] transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isExpanded ? "Tutup Komentar" : `Lihat ${thread.total_komentar} Balasan & Diskusi`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Thread Comments */}
                {isExpanded && (
                  <div className="border-t border-stroke bg-[#F7FAFC]/80 p-5 sm:p-6 space-y-5">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-[#0369A1]" />
                      Thread Balasan & Komentar
                    </h4>

                    {/* Comments List */}
                    {commentsApi.loading ? (
                      <LoadingState label="Memuat tanggapan diskusi" />
                    ) : commentsApi.error ? (
                      <ErrorState error={commentsApi.error} onRetry={commentsApi.reload} />
                    ) : (commentsApi.data ?? []).length === 0 ? (
                      <div className="p-4 bg-white rounded-md border border-stroke text-center text-xs text-secondary">
                        Belum ada balasan pada topik ini. Jadilah yang pertama memberikan tanggapan!
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                        {(commentsApi.data ?? []).map((comm, cIdx) => (
                          <div
                            key={cIdx}
                            className={`p-4 rounded-md border transition-all ${
                              comm.is_self
                                ? "bg-[#F0F7FB] border-[#0369A1]/30 ml-4 sm:ml-8"
                                : "bg-white border-stroke mr-4 sm:mr-8"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground">
                                  {comm.nama || "Mahasiswa"}
                                </span>
                                {comm.nim && (
                                  <span className="font-mono text-[10px] text-secondary">
                                    ({comm.nim})
                                  </span>
                                )}
                                {comm.is_self && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0369A1] text-white">
                                    Anda
                                  </span>
                                )}
                              </div>
                              {comm.tanggal && (
                                <span className="text-[10px] text-secondary font-mono">
                                  {comm.tanggal}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                              {comm.komentar}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Form Reply */}
                    <form onSubmit={(e) => handleSendReply(e, thread)} className="pt-3 border-t border-stroke space-y-3">
                      <label htmlFor={`reply-input-${thread.id_chat}`} className="block text-xs font-bold text-foreground">
                        Tulis Tanggapan Anda:
                      </label>
                      <textarea
                        id={`reply-input-${thread.id_chat}`}
                        rows={3}
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Ketik jawaban diskusi, tanggapan tugas, atau pertanyaan untuk dosen..."
                        className={inputClass}
                      />

                      {replyError && (
                        <div className="p-3 bg-[#FFF1F2] border border-[#BE123C]/20 rounded-md text-[#BE123C] text-xs">
                          {replyError}
                        </div>
                      )}
                      {replySuccess && (
                        <div className="p-3 bg-[#F0FDF4] border border-[#22C55E]/30 rounded-md text-[#15803D] text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{replySuccess}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={submittingReply}
                          className={`${primaryButtonClass} text-xs py-2`}
                        >
                          <Send className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{submittingReply ? "Mengirimkan..." : "Kirim Balasan"}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Create New Discussion */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#072033]/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCreateModalOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-discussion-title"
            className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl z-10 flex flex-col overflow-hidden border border-stroke"
          >
            <div className="flex items-center justify-between p-4 border-b border-stroke bg-[#F7FAFC]">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#0369A1]">
                  MyBest Forum
                </span>
                <h3 id="create-discussion-title" className="text-base font-display font-bold text-foreground">
                  Buat Topik Diskusi Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Tutup jendela"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm text-secondary hover:text-foreground hover:bg-[#F0F7FB]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="p-6 space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-secondary font-medium">
                  Mata Kuliah: <strong className="text-foreground">{activeCourse?.nama}</strong>
                </span>
              </div>

              <div className="space-y-2">
                <label htmlFor="new-disc-title" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Judul Topik Diskusi <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  id="new-disc-title"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Pertanyaan Tugas Pertemuan 4"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="new-disc-content" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Isi Diskusi / Penjelasan <span className="text-[#BE123C]">*</span>
                </label>
                <textarea
                  id="new-disc-content"
                  rows={4}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Jelaskan pertanyaan atau topik diskusi yang ingin dibahas bersama dosen dan teman sekelas..."
                  className={inputClass}
                />
              </div>

              {createError && (
                <div className="p-3 bg-[#FFF1F2] border border-[#BE123C]/20 rounded-md text-[#BE123C] text-xs">
                  {createError}
                </div>
              )}

              <div className="pt-3 border-t border-stroke flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className={`${ghostButtonClass} text-xs py-2`}
                  disabled={creatingTopic}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingTopic}
                  className={`${primaryButtonClass} text-xs py-2`}
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{creatingTopic ? "Membuat..." : "Publikasikan Topik"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
