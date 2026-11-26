import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const LAST_UPDATED = new Date("2026-11-26T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/demo",
    "/developers",
    "/login",
    "/lupa-password",
    "/privacy",
    "/terms",
    "/dmca",
  ];

  return routes.map((route) => ({
    url: route === "/" ? SITE_URL : `${SITE_URL}${route}`,
    lastModified: LAST_UPDATED,
  }));
}
