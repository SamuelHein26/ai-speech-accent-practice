"use client";
import Header from "../components/Header";

export default function Help() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-x-hidden overflow-y-auto transition-colors">
    <Header/>
     <section className="flex flex-col items-center pt-12 bg-white dark:bg-gray-900 transition-colors px-5 py-5 ">
        {/* Page Header */}
        <h1 className="text-5xl font-extrabold text-red-600 dark:text-red-500 mb-8 text-center tracking-tight">
          Help & Support
        </h1>

        {/* Introduction */}
        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-10 text-center">
          Welcome to the <span className="font-semibold text-red-600 dark:text-red-400">AI Accent Training</span> 
          help center. Here you will find step-by-step guidance on how to use each feature effectively, 
          along with troubleshooting tips and FAQs to optimize your speaking experience.
        </p>

        {/* Section 1: Getting Started */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            1. Getting Started
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
            To begin using the platform:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li>Click on <span className="font-medium text-red-600 dark:text-red-400">Login</span> and sign in using your registered account.</li>
            <li>Navigate to the <span className="font-medium">Monologue Mode</span> or <span className="font-medium">Accent Training</span> section via the top navigation bar.</li>
            <li>Allow microphone permissions when prompted to enable real-time voice interaction.</li>
          </ul>
        </div>

        {/* Section 2: Monologue Mode */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            2. Monologue Mode
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
            The <span className="font-medium text-red-600 dark:text-red-400">Monologue Mode</span> enables you to speak continuously for up to 3 minutes 
            on any topic of your choice. AI will:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li>Monitor your fluency, vocabulary diversity, and speech clarity.</li>
            <li>Provide topic suggestions if you hesitate or run out of ideas.</li>
            <li>Generate feedback including coherence, pacing, and pronunciation balance.</li>
          </ul>
        </div>

        {/* Section 3: Accent Training */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            3. Accent Training
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
            The <span className="font-medium text-red-600 dark:text-red-400">Accent Training</span> module is designed to enhance pronunciation and rhythm accuracy. 
            You can:
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li>Read aloud pre-defined or custom passages.</li>
            <li>Receive AI-based marking on mispronounced words with real-time visual cues.</li>
            <li>Review playback and compare pronunciation with a native model.</li>
          </ul>
        </div>

        {/* Section 4: Troubleshooting */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            4. Troubleshooting
          </h2>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li><span className="font-medium">No audio detected:</span> Ensure your microphone is connected and permissions are granted in browser settings.</li>
            <li><span className="font-medium">Feedback not showing:</span> Try refreshing the page or checking your internet connection.</li>
            <li><span className="font-medium">AI response delay:</span> This may occur due to network latency — allow a few seconds for processing.</li>
          </ul>
        </div>

        {/* Section 5: Contact Support */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            5. Contact Support
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            For additional assistance, please reach out to our support team at{" "}
            <a
              href="mailto:support@aiaccenttraining.com"
              className="text-red-600 dark:text-red-400 font-medium hover:underline"
            >
              support@aiaccenttraining.com
            </a>
            . We aim to respond within 24 hours on business days.
          </p>
      </div>
    </section>
    </div>
  );
}
