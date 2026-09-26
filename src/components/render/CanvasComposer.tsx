"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { Variant } from "@/lib/types";

export interface CanvasComposerRef {
  renderAsset: () => Promise<string>;
}

export const CanvasComposer = forwardRef<CanvasComposerRef, { variant: Variant }>(
  ({ variant }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [progress, setProgress] = useState("");

    useImperativeHandle(ref, () => ({
      renderAsset: async () => {
        setProgress("Loading fonts...");
        const fontName = variant.lang === "bn" ? "Noto Sans Bengali" : "Inter";
        // Attempt to load fonts
        try {
          await document.fonts.load(`bold 40px "${fontName}"`);
          if (variant.lang === "bn") {
             await document.fonts.load(`bold 40px "Hind Siliguri"`);
          }
        } catch (e) {
          console.warn("Font load error", e);
        }

        setProgress("Loading image...");
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas not found");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Context not found");

        // Determine size and layout
        const isInstagram = variant.channel === "instagram";
        const width = isInstagram ? 1080 : 1600;
        const height = isInstagram ? 1350 : 900;
        canvas.width = width;
        canvas.height = height;

        // Base image
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = variant.assetUrl || "https://picsum.photos/1600/1350"; // Fallback for testing
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => {
            // Draw a fallback background if image fails to load
            ctx.fillStyle = "#333";
            ctx.fillRect(0, 0, width, height);
            resolve(null);
          };
        });

        // Draw image cover
        if (img.width) {
          const scale = Math.max(width / img.width, height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (width - w) / 2;
          const y = (height - h) / 2;
          ctx.drawImage(img, x, y, w, h);
        }

        // Scrim
        if (isInstagram) {
          const grad = ctx.createLinearGradient(0, height * 0.5, 0, height);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, "rgba(0,0,0,0.8)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, height * 0.5, width, height * 0.5);
        } else {
          const grad = ctx.createLinearGradient(0, 0, width * 0.6, 0);
          grad.addColorStop(0, "rgba(0,0,0,0.8)");
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width * 0.6, height);
        }

        // Brand bug (Top right)
        ctx.fillStyle = "#E50914"; // hoichoi red
        ctx.fillRect(width - 150, 40, 110, 40);
        ctx.fillStyle = "white";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("hoichoi", width - 95, 60);

        // Text Overlay
        ctx.fillStyle = "white";
        ctx.font = `bold ${isInstagram ? 60 : 70}px "${fontName}", sans-serif`;
        
        const hookText = variant.caption; // Use caption as hook for now
        
        if (isInstagram) {
          ctx.textAlign = "center";
          wrapText(ctx, hookText, width / 2, height * 0.8, width * 0.8, 80);
        } else {
          ctx.textAlign = "left";
          wrapText(ctx, hookText, 100, height * 0.4, width * 0.4, 90);
        }

        setProgress("Exporting...");
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(b => {
            if (b) resolve(b);
            else reject(new Error("toBlob failed"));
          }, "image/png");
        });

        // Upload to /api/assets
        setProgress("Uploading...");
        const formData = new FormData();
        formData.append("file", blob, `variant-${variant.id}.png`);
        
        let finalUrl = URL.createObjectURL(blob);
        
        try {
          const res = await fetch("/api/assets", {
            method: "POST",
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            finalUrl = data.url;
          }
        } catch (e) {
          console.warn("Upload failed, using local blob URL", e);
          // TODO(lib): Implement actual asset upload
        }

        setProgress("");
        return finalUrl;
      }
    }));

    // Helper for wrapping text
    function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
      const words = text.split(' ');
      let line = '';
      let currentY = y;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
    }

    return (
      <div className="flex flex-col items-center gap-2">
        <canvas ref={canvasRef} className="max-w-full h-auto rounded border border-zinc-700 hidden" />
        {progress && <span className="text-xs text-blue-400">{progress}</span>}
      </div>
    );
  }
);
CanvasComposer.displayName = "CanvasComposer";
