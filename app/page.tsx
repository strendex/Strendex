export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 to-gray-800">
      <div className="text-center flex flex-col items-center px-6 py-12 rounded-2xl shadow-2xl bg-zinc-950 bg-opacity-80 max-w-xl w-full">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Compare your hybrid stats.
        </h1>
        <p className="text-lg md:text-xl text-gray-400 mb-8">
          The global benchmark for strength and endurance.
        </p>
        <a
          href="/score"
          className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-lg shadow-lg transition hover:from-indigo-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Get Started
        </a>
      </div>
    </main>
  );
}