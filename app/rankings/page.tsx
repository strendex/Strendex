export default function RankingsPage() {
  const players = [
    { rank: 1, name: "Player One", score: 2500 },
    { rank: 2, name: "Player Two", score: 2100 },
    { rank: 3, name: "Player Three", score: 1800 },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Global Rankings</h1>
      <div className="max-w-2xl mx-auto border border-gray-800 rounded-lg">
        <table className="w-full text-left">
          <thead className="bg-gray-900">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Name</th>
              <th className="p-4 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.rank} className="border-t border-gray-800">
                <td className="p-4">{player.rank}</td>
                <td className="p-4">{player.name}</td>
                <td className="p-4 text-right font-mono text-green-400">{player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}