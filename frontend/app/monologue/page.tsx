"use client";
import { useState, useRef } from "react";

export default function MonologuePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // Start Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); //Get permission for microphone
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Send to backend
        uploadAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Upload to backend
  const uploadAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");

    const response = await fetch("http://127.0.0.1:8000/api/monologue/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    console.log("Backend response:", data);

    if (data.transcript) {
      setTranscript(data.transcript);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h2 className="text-3xl font-bold mb-6">Monologue Mode</h2>
    <div className="font-bold mb-6">Click button to start Recording</div>
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

      {audioUrl && (
        <div className="mt-6">
          <p className="mb-2">Your Recording:</p>
          <audio controls src={audioUrl}></audio>
        </div>
      )}

      {transcript && (
        <div className="mt-6 max-w-xl bg-gray-100 p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-2">Transcript:</h3>
          <p>{transcript}</p>
        </div>
      )}
    </main>
  );
}
