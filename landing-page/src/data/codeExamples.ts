import { CodeExample } from "@/types";

export const CODE_EXAMPLES: Record<string, CodeExample> = {
  curl: {
    language: "curl",
    title: "cURL",
    snippet: `curl -X GET "https://api.muaraai.com/v1/ubsi-api/v1/elearning/courses" \\
  -H "Authorization: Bearer <session_token>" \\
  -H "Accept: application/json"`,
    response: `{
  "success": true,
  "data": [
    {
      "code": "101",
      "name": "Dasar Manajemen Bisnis",
      "sks": 3,
      "lecturer": "Dr. Ir. Hendra S., M.Kom",
      "schedule": "Senin, 08:00 - 10:30 WIB",
      "assignments_pending": 0
    },
    {
      "code": "104",
      "name": "Logika & Algoritma",
      "sks": 4,
      "lecturer": "Ahmad Fauzi, M.Kom",
      "schedule": "Selasa, 10:30 - 13:00 WIB",
      "assignments_pending": 1
    },
    {
      "code": "153",
      "name": "Pengantar Teknologi Informasi",
      "sks": 3,
      "lecturer": "Budi Santoso, M.Kom",
      "schedule": "Rabu, 13:30 - 16:00 WIB",
      "assignments_pending": 0
    }
  ],
  "cached": true
}`,
    latencyMs: 238,
  },
  python: {
    language: "python",
    title: "Python (requests)",
    snippet: `import requests

headers = {
    "Authorization": "Bearer session_token_anda"
}

response = requests.get(
    "https://api.muaraai.com/v1/ubsi-api/v1/elearning/courses", 
    headers=headers
)
data = response.json()
print(f"Total Kursus Aktif: {len(data['data'])}")`,
    response: `{
  "success": true,
  "data": [
    {
      "code": "101",
      "name": "Dasar Manajemen Bisnis",
      "sks": 3,
      "lecturer": "Dr. Ir. Hendra S., M.Kom",
      "schedule": "Senin, 08:00 - 10:30 WIB"
    },
    {
      "code": "104",
      "name": "Logika & Algoritma",
      "sks": 4,
      "lecturer": "Ahmad Fauzi, M.Kom",
      "schedule": "Selasa, 10:30 - 13:00 WIB"
    }
  ],
  "cached": true
}`,
    latencyMs: 242,
  },
  typescript: {
    language: "typescript",
    title: "TypeScript (fetch)",
    snippet: `const res = await fetch("https://api.muaraai.com/v1/ubsi-api/v1/elearning/courses", {
  headers: {
    "Authorization": \`Bearer \${process.env.UBSI_SESSION_TOKEN}\`
  },
  next: { revalidate: 60 }
});

const { data } = await res.json();
console.log(data);`,
    response: `{
  "success": true,
  "data": [
    {
      "code": "101",
      "name": "Dasar Manajemen Bisnis",
      "sks": 3,
      "lecturer": "Dr. Ir. Hendra S., M.Kom",
      "schedule": "Senin, 08:00 - 10:30 WIB"
    }
  ],
  "cached": true
}`,
    latencyMs: 229,
  },
};
