import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: ["/dashboard/", "/login", "/api/"],
    },
    sitemap: "https://ubsi-api.muaraai.com/sitemap.xml",
  };
}
