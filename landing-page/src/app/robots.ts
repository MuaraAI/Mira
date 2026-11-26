import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Halaman publik boleh dibaca mesin pencari dan crawler AI; dashboard (data pribadi) dan API tidak.
const PRIVATE_PATHS = ["/dashboard", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
