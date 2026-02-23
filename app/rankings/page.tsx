import Link from "next/link";
import Image from "next/image";

export default function RankingsPage() {
  const players = [
    { rank: 1, name: "Player One", score: 2500 },
    { rank: 2, name: "Player Two", score: 2100 },
    { rank: 3, name: "Player Three", score: 1800 },
    { rank: 4, name: "Player Four", score: 1650 },
    { rank: 5, name: "Player Five", score: 1500 },
  ];

  const topThree = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <main className="min-h-screen bg-[#020203] text-zinc-200 font-sans antialiased">

      {/* BACKGROUND */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.18),_transparent_60%)] blur-2xl"/>
        <div className="absolute top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.10),_transparent_60%)] blur-2xl"/>
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      {/* NAV */}
      <header className="border-b border-white/5 bg-[#020203]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <Image
                src="/logo.png"
                alt="Strendex"
                fill
                className="object-contain p-1"
              />
            </div>

            <div>
              <div className="text-sm font-semibold tracking-wide text-white">
                STRENDEX
              </div>
              <div className="text-[11px] text-zinc-500">
                Global Leaderboard
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/tool"
              className="px-4 py-2 text-sm border border-white/10 rounded-full hover:bg-white/[0.05] transition"
            >
              Open Tool
            </Link>

            <Link
              href="/"
              className="px-4 py-2 text-sm bg-white text-black rounded-full font-semibold hover:bg-zinc-200 transition"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* PAGE */}
      <section className="max-w-6xl mx-auto px-6 py-16">

        {/* TITLE */}
        <div className="text-center mb-14">
          <h1 className="text-5xl font-semibold text-white tracking-tight">
            Global Rankings
          </h1>
          <p className="mt-3 text-zinc-400">
            Top performers across the Strendex ecosystem
          </p>
        </div>

        {/* PODIUM */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">

          {topThree.map((player) => (
            <div
              key={player.rank}
              className={`rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center relative
              ${player.rank === 1 ? "shadow-[0_0_50px_rgba(34,197,94,0.25)]" : ""}`}
            >

              <div className="text-xs uppercase tracking-widest text-zinc-500">
                Rank
              </div>

              <div className="text-4xl font-bold text-white mt-1">
                #{player.rank}
              </div>

              <div className="mt-4 text-xl font-semibold text-white">
                {player.name}
              </div>

              <div className="mt-2 font-mono text-emerald-400 text-lg">
                {player.score}
              </div>

              {player.rank === 1 && (
                <div className="absolute top-3 right-3 text-[10px] px-2 py-1 bg-emerald-400/20 text-emerald-300 rounded-full border border-emerald-400/20 uppercase tracking-widest">
                  Leader
                </div>
              )}
            </div>
          ))}

        </div>

        {/* FULL TABLE */}
        <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02]">

          <table className="w-full text-left">

            <thead className="bg-black/40 text-xs uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">Athlete</th>
                <th className="px-6 py-4 text-right">HQ Score</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">

              {players.map((player) => (
                <tr
                  key={player.rank}
                  className="hover:bg-white/[0.04] transition"
                >
                  <td className="px-6 py-4 font-semibold text-zinc-400">
                    #{player.rank}
                  </td>

                  <td className="px-6 py-4 text-white font-medium">
                    {player.name}
                  </td>

                  <td className="px-6 py-4 text-right font-mono text-emerald-400">
                    {player.score}
                  </td>
                </tr>
              ))}

            </tbody>

          </table>

        </div>

        {/* FOOTER NOTE */}
        <div className="text-center mt-10 text-xs text-zinc-600 tracking-widest uppercase">
          Rankings update automatically from the Strendex database
        </div>

      </section>
    </main>
  );
}