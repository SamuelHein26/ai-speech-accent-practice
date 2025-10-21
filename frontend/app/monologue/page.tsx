"use client";
import Header from "../components/Header";
import { useState, useRef, useEffect } from "react";
import LiveWaveform from "../components/LiveWaveform";

export default function MonologuePage() {
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    setMounted(true);
    const existing = sessionStorage.getItem("guest_session_id");
    if (existing) {
      sessionRef.current = existing;
      console.log("Resumed guest session:", existing);
    }
  }, []);

  if (!mounted) return null;

  

  // Initialize a new session (guest or user)
  const startRecording = async () => {
    setError(null);
    try {
      const token = localStorage.getItem("token");

      const res = await fetch("http://127.0.0.1:8000/session/start", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start session");
      }

      const data = await res.json();
      sessionRef.current = data.session_id;
      sessionStorage.setItem("guest_session_id", data.session_id);
      console.log("Started new session:", data.session_id);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;

      audioChunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mr.start();
      setIsRecording(true);
      setFinalTranscript("");
      setAudioUrl(null);
    } catch (err: any) {
      console.error("Session start error:", err);
      setError(err.message);
    }
  };

  // Stop recording and process final transcription
  const stopRecording = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;

    mr.stop();

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
    });

    setIsRecording(false);
    setIsProcessing(true);
    setError(null);

    if (!sessionRef.current) {
      setError("Session not initialized.");
      setIsProcessing(false);
      return;
    }

    try {
      // Combine all chunks
      const blob = new Blob(audioChunks.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("file", blob, "final.webm");

      // Upload final audio chunk
      const uploadRes = await fetch(`http://127.0.0.1:8000/session/${sessionRef.current}/chunk`, {
        method: "POST",
        body: fd,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.detail || "Failed to upload audio chunk");
      }

      // Finalize and transcribe
      const finalizeRes = await fetch(`http://127.0.0.1:8000/session/${sessionRef.current}/finalize`, {
        method: "POST",
      });

      if (!finalizeRes.ok) {
        const err = await finalizeRes.json();
        throw new Error(err.detail || "Transcription failed");
      }

      const data = await finalizeRes.json();
      setFinalTranscript(data.final || "Transcription incomplete.");
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(err.message);
      setFinalTranscript("Transcription failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {!isRecording && (
          <>
            <h2 className="text-4xl font-bold mb-8 text-gray-900 dark:text-gray-100">
              Monologue Mode
            </h2>
            <p className="max-w-2xl text-center text-gray-700 dark:text-gray-300 text-lg mb-8">
              Practice your speaking fluency for up to{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">3 minutes</span>.
              If you pause for too long, you’ll automatically receive topic suggestions
              to keep the monologue flowing.
            </p>
          </>
        )}

        <div className="flex space-x-4 mb-8">
          {!isRecording && !isProcessing ? (
            <button
              onClick={startRecording}
              className="px-6 py-4 bg-gray-700 text-white rounded-full shadow hover:bg-red-900 transition-colors"
            >
              Start Recording
            </button>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="px-8 py-3 bg-red-600 text-white rounded-full shadow hover:bg-red-700"
            >
              Stop Recording
            </button>
          ) : (
            <button disabled className="px-8 py-3 bg-gray-500 text-white rounded-full shadow">
              Processing...
            </button>
          )}
        </div>

        {isRecording && <LiveWaveform isRecording={isRecording} />}

        {error && (
          <div className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 p-4 rounded-xl shadow mb-6 max-w-2xl">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {finalTranscript && (
          <div className="w-full max-w-2xl bg-green-50 dark:bg-green-900/40 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-2">Final Transcript</h3>
            <p className="whitespace-pre-line">{finalTranscript}</p>
          </div>
        )}

        {audioUrl && (
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Playback</h3>
            <audio controls src={audioUrl} className="w-full mt-2"></audio>
          </div>
        )}
      </main>
    </div>
  );
}
