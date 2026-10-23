import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Dipanggil service worker saat browser merotasi endpoint push
 * (event `pushsubscriptionchange`): daftarkan ulang endpoint baru
 * ke backend dengan sesi cookie mahasiswa yang sama.
 */
export async function POST(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { success: false, error: { code: "CONFIG_MISSING", message: "API base belum disetel" } },
      { status: 500 },
    );
  }
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie.includes("ubsi_session=")) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak ditemukan" } },
      { status: 401 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Body JSON tidak valid" } },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_BASE}/v1/notifications/pwa/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      // Backend ambient cookie auth hanya menerima dari dashboard resmi
      "X-Requested-With": "dashboard",
      Origin: request.nextUrl.origin || "https://mira.muaraai.com",
      Referer: `${request.nextUrl.origin || "https://mira.muaraai.com"}/dashboard/notifikasi`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
