"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { Variant } from "@/lib/types";

export interface VideoComposerRef {
  renderAsset: () => Promise<string>;
}

export const VideoComposer = forwardRef<VideoComposerRef, { variant: Variant }>(
  ({ variant }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [progress, setProgress] = useState("");

    useImperativeHandle(ref, () => ({
      renderAsset: async () => {
        setProgress("Loading fonts...");
        const fontName = variant.lang === "bn" ? "Noto Sans Bengali" : "Inter";
        try {
          await document.fonts.load(`bold 60px "${fontName}"`);
        } catch (e) {
          console.warn("Font load error", e);
        }

        setProgress("Loading image...");
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas not found");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Context not found");

        const width = 1080;
        const height = 1920;
        canvas.width = width;
        canvas.height = height;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = variant.assetUrl || "https://picsum.photos/1080/1920";
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = () => resolve(null); // Fallback to blank
        });

        setProgress("Rendering video...");
        
        // Setup MediaRecorder
        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (e) => chunks.push(e.data);

        return new Promise<string>((resolve, reject) => {
          recorder.onstop = async () => {
            setProgress("Uploading video...");
            const blob = new Blob(chunks, { type: mimeType });
            
            const formData = new FormData();
            formData.append("file", blob, `variant-${variant.id}.${mimeType.includes("mp4") ? "mp4" : "webm"}`);
            
            let finalUrl = URL.createObjectURL(blob);
            
            try {
              const res = await fetch("/api/assets", { method: "POST", body: formData });
              if (res.ok) {
                const data = await res.json();
                finalUrl = data.url;
              }
            } catch (e) {
              console.warn("Upload failed, using local blob URL", e);
              // TODO(lib): Implement actual asset upload
            }
            
            setProgress("");
            resolve(finalUrl);
          };

          recorder.start();

          // Animation loop
          const duration = 10; // seconds
          const fps = 30;
          const totalFrames = duration * fps;
          let frame = 0;
          
          const words = (variant.caption || "").split(" ");
          
          const drawFrame = () => {
            if (frame >= totalFrames) {
              recorder.stop();
              return;
            }

            const t = frame / totalFrames; // 0 to 1

            // Ken Burns (zoom slowly from 1.0 to 1.15)
            const scale = 1.0 + (t * 0.15);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, width, height);

            if (img.width) {
              const imgScale = Math.max(width / img.width, height / img.height) * scale;
              const w = img.width * imgScale;
              const h = img.height * imgScale;
              const x = (width - w) / 2;
              const y = (height - h) / 2;
              ctx.drawImage(img, x, y, w, h);
            }

            // Darken scrim for text
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillRect(0, 0, width, height);

            // Safe zones: avoid top 12%, bottom 20%
            const safeTop = height * 0.12;
            const safeBottom = height * 0.80;

            // Animate captions word by word
            // Let's show words progressively
            if (t < 0.8) {
              // Show words from 0s to 8s
              const wordTime = 0.8 / words.length;
              const currentWordIdx = Math.floor(t / wordTime);
              
              if (currentWordIdx < words.length) {
                const activeWord = words[currentWordIdx];
                ctx.fillStyle = "white";
                ctx.font = `bold 80px "${fontName}", sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(activeWord, width / 2, height / 2);
              }
            } else {
              // End card for last 2 seconds
              ctx.fillStyle = "black";
              ctx.fillRect(0, 0, width, height);
              ctx.fillStyle = "#E50914";
              ctx.font = `bold 100px sans-serif`;
              ctx.textAlign = "center";
              ctx.fillText("hoichoi", width / 2, height / 2 - 60);
              
              ctx.fillStyle = "white";
              ctx.font = `bold 50px "${fontName}", sans-serif`;
              ctx.fillText(variant.caption.slice(0, 30) + "...", width / 2, height / 2 + 60);
            }

            frame++;
            setProgress(`Rendering frame ${frame}/${totalFrames}`);
            // Use setTimeout to avoid blocking main thread completely
            setTimeout(drawFrame, 0);
          };

          drawFrame();
        });
      }
    }));

    return (
      <div className="flex flex-col items-center gap-2 mt-2">
        <canvas ref={canvasRef} className="w-full max-w-[200px] h-auto rounded border border-zinc-700 hidden" />
        {progress && <div className="text-xs text-blue-400 font-mono bg-blue-900/20 px-2 py-1 rounded">{progress}</div>}
      </div>
    );
  }
);
VideoComposer.displayName = "VideoComposer";
