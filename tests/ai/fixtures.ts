import sharp from "sharp";

// Deterministic synthetic "scenes" rendered from SVG so tests need no network or fixture files.
export async function scene(kind: "street" | "portrait", width: number, height: number): Promise<Buffer> {
  const svg =
    kind === "street"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 160 90" preserveAspectRatio="none">
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#101820"/><stop offset="1" stop-color="#f2aa4c"/></linearGradient></defs>
          <rect width="160" height="90" fill="url(#g)"/>
          <rect x="10" y="30" width="25" height="60" fill="#333"/>
          <rect x="60" y="15" width="20" height="75" fill="#ddd"/>
          <rect x="110" y="40" width="35" height="50" fill="#222"/>
          <circle cx="130" cy="18" r="10" fill="#fff"/>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 80 100" preserveAspectRatio="none">
          <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f5f5f5"/><stop offset="1" stop-color="#1a1a2e"/></linearGradient></defs>
          <rect width="80" height="100" fill="url(#g)"/>
          <ellipse cx="25" cy="40" rx="18" ry="24" fill="#000"/>
          <rect x="50" y="60" width="30" height="40" fill="#fff"/>
          <circle cx="60" cy="20" r="6" fill="#555"/>
        </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
