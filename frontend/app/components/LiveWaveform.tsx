"use client";
import { useEffect, useRef } from "react";

export default function LiveWaveform({ isRecording }: { isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!isRecording) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioContextRef.current?.close().catch(() => {});
      return;
    }

    let isCancelled = false;

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; // moderate resolution for stable visual
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        sourceRef.current = source;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const draw = () => {
          if (isCancelled) return;
          animationRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          const { width, height } = canvas;
          const midX = width / 2;
          const midY = height / 2;
          ctx.clearRect(0, 0, width, height);

          // Background
          const isDark = document.documentElement.classList.contains("dark");
          const backgroundColor = isDark ? "#f8fafc" : "#0f172a"; // slate-900 vs slate-50

          // Fill background based on theme
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
          // Gradient
          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, "#a855f7"); 
          gradient.addColorStop(0.5, "#ef4444");
          gradient.addColorStop(1, "#a855f7"); 
          ctx.fillStyle = gradient;

          // Compute bar metrics
          const barCount = 60;
          const step = Math.floor(bufferLength / barCount);
          const barWidth = (width / 2) / barCount / 1.4; // half width spread
          const amplitude = height * 0.8;

          // Draw left and right halves symmetrically
          for (let i = 0; i < barCount; i++) {
            const v = dataArray[i * step] / 255.0;
            const barHeight = v * amplitude * 0.5;

            const offset = i * (barWidth + 3);

            // Left bars (mirror)
            ctx.fillRect(midX - offset - barWidth, midY - barHeight / 2, barWidth, barHeight);

            // Right bars
            ctx.fillRect(midX + offset, midY - barHeight / 2, barWidth, barHeight);
          }
        };

        draw();
      } catch (err) {
        console.error("[LiveWaveform] Microphone access error:", err);
      }
    };

    initAudio();

    return () => {
      isCancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioContextRef.current?.close().catch(() => {});
    };
  }, [isRecording]);

  return (
    <div className="w-full flex justify-center my-6 ">
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full max-w-3xl rounded-xl shadow-inner"
      />
    </div>
  );
}
