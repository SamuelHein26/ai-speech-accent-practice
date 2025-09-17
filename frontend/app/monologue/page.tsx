"use client";
import { useState, useRef } from "react";

export default function MonologuePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mediaRecorder;

    wsRef.current = new WebSocket("ws://127.0.0.1:8000/ws/monologue");

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.partial) {
        setTranscript((prev) => prev + " " + data.partial);
      }
    };

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.current.push(event.data);
        event.data.arrayBuffer().then((buffer) => {
          wsRef.current?.send(buffer);
        });
      }
    };

    mediaRecorder.start(1000);
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    wsRef.current?.close();
    setIsRecording(false);

    // Save full audio for playback
    const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    audioChunks.current = [];
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h2 className="text-3xl font-bold mb-6">Monologue Mode (Live)</h2>

      <div className="flex space-x-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Stop Recording
          </button>
        )}
      </div>

      {transcript && (
        <div className="mt-6 max-w-xl bg-gray-100 p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-2">Live Transcript:</h3>
          <p>{transcript}</p>
        </div>
      )}

      {audioUrl && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Playback:</h3>
          <audio controls src={audioUrl}></audio>
        </div>
      )}
    </main>
  );
}
