import React from "react";

type Props = {
  text: string;
  topics: string[];
  loading?: boolean;
};

export default function LiveTranscriptionBox({ text, topics, loading }: Props) {
  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Live transcript container */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Live Transcript
        </h3>
        <div className="min-h-[120px] whitespace-pre-wrap text-gray-900 dark:text-gray-100">
          {text || "…waiting for speech…"}
        </div>
      </div>

      {/* Topic suggestion bubbles */}
      {topics.length > 0 && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Suggestions for your next thought
            </h4>
            {loading && (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                generating…
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {topics.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="px-3 py-1 rounded-full bg-yellow-500 text-white text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}