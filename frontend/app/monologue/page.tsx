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

  const sessionRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Start Recording
  const startRecording = async () => {
    const res = await fetch("http://127.0.0.1:8000/session/start", { method: "POST" });
    const data = await res.json();
    sessionRef.current = data.session_id;

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
  };

  // Stop Recording and Send to Backend
  const stopRecording = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.stop();

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
    });

    setIsRecording(false);
    setIsProcessing(true);

    if (!sessionRef.current) return;

    // Combine all chunks
    const blob = new Blob(audioChunks.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob, "final.webm");

    // Upload final file
    await fetch(`http://127.0.0.1:8000/session/${sessionRef.current}/chunk`, {
      method: "POST",
      body: fd,
    });

    // Finalize transcription
    const res = await fetch(`http://127.0.0.1:8000/session/${sessionRef.current}/finalize`, {
      method: "POST",
    });
    const data = await res.json();
    setFinalTranscript(data.final || "Transcription failed.");

    // Build playback audio
    setAudioUrl(URL.createObjectURL(blob));
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 overflow-x-hidden overflow-y-auto transition-colors">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {!isRecording && (
          <>
            <h2 className="text-4xl font-bold mb-8 text-gray-900 dark:text-gray-100">
              Monologue Mode
            </h2>

            <div className="max-w-2xl mx-auto text-center mb-6">
              <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed pb-6">
                Speak and practice for up to{" "}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  3 minutes
                </span>{" "}
                on any topic with Monologue Mode. If you get stuck or run out of ideas,
                you’ll receive
                <span className="font-medium text-red-500 dark:text-red-300">
                  {" "}
                  dynamic topic suggestions{" "}
                </span>
                to keep the conversation flowing.
              </p>
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex space-x-4 mb-8">
          {!isRecording && !isProcessing ? (
            <button
              onClick={startRecording}
              className="px-5 py-5 bg-gray-700 text-white rounded-full shadow hover:bg-red-900 cursor-pointer transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                className="h-10 w-10 text-red-600 dark:text-red-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 1.75a3.25 3.25 0 00-3.25 3.25v6a3.25 3.25 0 006.5 0v-6A3.25 3.25 0 0012 1.75zM5 10.25a7 7 0 0014 0M12 17.25v4.5"
                />
              </svg>
            </button>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="px-8 py-3 bg-red-600 text-white rounded-full shadow hover:bg-red-700"
            >
              Stop Recording
            </button>
          ) : (
            <button
              disabled
              className="px-8 py-3 bg-gray-500 text-white rounded-full shadow"
            >
              Processing...
            </button>
          )}
        </div>
        
        {isRecording && <LiveWaveform isRecording={isRecording} />}

        {/* Final Transcript */}
        {finalTranscript && (
          <div className="w-full max-w-2xl bg-green-50 dark:bg-green-900/40 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-2">Final Transcript</h3>
            <p className="whitespace-pre-line">{finalTranscript}</p>
          </div>
        )}

        {/* Playback */}
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
