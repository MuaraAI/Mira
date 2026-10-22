// Salin worker pdf.js ke public/ supaya dimuat dari domain sendiri (tanpa CDN) saat pratinjau PDF dibuka.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/pdfjs", { recursive: true });
cpSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js", "public/pdfjs/pdf.worker.min.js");
