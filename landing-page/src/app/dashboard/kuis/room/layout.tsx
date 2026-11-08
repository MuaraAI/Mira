import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ruang Ujian CBT • MyBest & Mira",
  description: "Ruang ujian online CBT resmi terintegrasi dengan MyBest Elearning UBSI.",
};

export default function QuizRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased select-none">
      {children}
    </div>
  );
}
