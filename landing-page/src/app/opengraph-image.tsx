import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Mira: Satu Tempat untuk Seluruh Layanan Kampus UBSI";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#F7FAFC",
          padding: "64px 80px",
          fontFamily: "sans-serif",
          border: "8px solid #D9E5ED",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: "#0369A1",
              borderRadius: "10px",
              border: "2px solid #075985",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: "24px",
              fontWeight: "bold",
            }}
          >
            M
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#072033", fontSize: "28px", fontWeight: "bold" }}>
              Mira
            </span>
            <span style={{ color: "#0369A1", fontSize: "14px", letterSpacing: "2px" }}>
              BY MUARA AI
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "950px" }}>
          <span
            style={{
              color: "#072033",
              fontSize: "50px",
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: "16px",
            }}
          >
            Satu Tempat untuk Seluruh Layanan Kampus UBSI.
          </span>
          <span style={{ color: "#3B5A70", fontSize: "24px", lineHeight: 1.4 }}>
            SIAKAD dan MyBest: jadwal, absen, tugas, ujian, nilai, dan notifikasi ke HP.
          </span>
        </div>

        <div style={{ display: "flex", gap: "20px" }}>
          <div
            style={{
              backgroundColor: "#F0F7FB",
              padding: "10px 20px",
              borderRadius: "8px",
              color: "#0369A1",
              fontSize: "18px",
              border: "1px solid #D9E5ED",
            }}
          >
            Dashboard Akademik
          </div>
          <div
            style={{
              backgroundColor: "#F0F7FB",
              padding: "10px 20px",
              borderRadius: "8px",
              color: "#0369A1",
              fontSize: "18px",
              border: "1px solid #D9E5ED",
            }}
          >
            PWA Mobile & Desktop
          </div>
          <div
            style={{
              backgroundColor: "#F0F7FB",
              padding: "10px 20px",
              borderRadius: "8px",
              color: "#3B5A70",
              fontSize: "18px",
              border: "1px solid #D9E5ED",
            }}
          >
            Open Source (MIT)
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
