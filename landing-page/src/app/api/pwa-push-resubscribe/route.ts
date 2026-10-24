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
  if (request.headers.get("x-requested-with") !== "sw") {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Hanya diizinkan dari Service Worker internal" } },
      { status: 403 },
    );
  }
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin") {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Permintaan lintas origin ditolak" } },
      { status: 403 },
    );
  }
  const originHeader = request.headers.get("origin");
  if (originHeader && originHeader !== request.nextUrl.origin) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Origin tidak cocok" } },
      { status: 403 },
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
  const payloadObj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  const keysObj =
    payloadObj && typeof payloadObj.keys === "object" && payloadObj.keys !== null
      ? (payloadObj.keys as Record<string, unknown>)
      : null;
  if (
    !payloadObj ||
    typeof payloadObj.endpoint !== "string" ||
    !payloadObj.endpoint.startsWith("https://") ||
    !keysObj ||
    typeof keysObj.p256dh !== "string" ||
    typeof keysObj.auth !== "string"
  ) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Payload push subscription tidak valid" } },
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
    body: JSON.stringify({
      endpoint: payloadObj.endpoint,
      keys: { p256dh: keysObj.p256dh, auth: keysObj.auth },
    }),
    cache: "no-store",
  });

  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
