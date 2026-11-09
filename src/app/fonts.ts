import localFont from "next/font/local";

// Overpass is drawn from highway sign lettering: open shapes that stay readable at a glance in sunlight.
export const latin = localFont({
  src: [
    { path: "./fonts/overpass-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/overpass-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/overpass-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-latin",
  display: "swap",
});

// Noto Sans Ethiopic for Amharic (Ge'ez script). Latin glyphs fall through to Overpass first.
export const ethiopic = localFont({
  src: [
    { path: "./fonts/noto-sans-ethiopic-ethiopic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-sans-ethiopic-ethiopic-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-ethiopic",
  display: "swap",
  preload: false,
});
