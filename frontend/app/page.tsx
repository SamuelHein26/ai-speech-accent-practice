import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <header className="w-full flex justify-between items-center px-8 py-4 shadow bg-white">
        <h1 className="text-2xl font-bold text-red-600">ComfTalk</h1>
        <nav className="flex items-center space-x-4">
          <Link href="/login" className="focus:outline-none text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 mb-2">
            Login
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-20 px-6">
        <h2 className="text-4xl font-bold text-gray-800 mb-4">
          Improve Your Fluency & Accent with AI
        </h2>
        <p className="text-gray-600 max-w-2xl">
          Choose your training mode below to start practicing and get real-time
          feedback powered by AI.
        </p>
      </section>

      {/* Options Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8 pb-20">
        {/* Monologue Mode */}
        <div className="bg-white shadow rounded-2xl p-8 text-center hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold text-red-600 mb-4">
            Monologue Mode
          </h3>
          <p className="text-gray-600 mb-6">
            Speak freely for 3-5 minutes. AI tracks your flow and generates
            topic bubbles if you run out of ideas.
          </p>
          <Link
            href="/monologue"
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Start Monologue
          </Link>
        </div>

        {/* Accent Training */}
        <div className="bg-white shadow rounded-2xl p-8 text-center hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold text-red-600 mb-4">
            Accent Training
          </h3>
          <p className="text-gray-600 mb-6">
            Read passages aloud and the AI will underline mispronounced words and
            provides feedback on pronunciation.
          </p>
          <Link
            href="/accent"
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Start Training
          </Link>
        </div>
      </section>
    </main>
  );
}
