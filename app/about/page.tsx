export default function AboutPage() {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-white">About Strendex</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          Strendex is a hybrid performance benchmarking platform built for athletes who train
          both strength and endurance. Enter your stats, get a Hybrid Quotient (HQ Score),
          see where you rank, and share a clean athlete card.
        </p>
  
        <div className="mt-10 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-white">Why Strendex exists</h2>
            <p className="mt-2 text-white/70 leading-relaxed">
              Hybrid athletes don’t have one standard place to measure “how good” they are across
              both lifting and running. Strendex aims to become the global benchmark — similar to how
              Strava became the platform for runners.
            </p>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">What you can do</h2>
            <ul className="mt-2 list-disc pl-5 text-white/70 space-y-2">
              <li>Calculate your HQ Score from strength + endurance metrics.</li>
              <li>See a rank band and archetype based on your profile.</li>
              <li>Compare on the leaderboard.</li>
              <li>Export a shareable athlete card.</li>
            </ul>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">Current stage</h2>
            <p className="mt-2 text-white/70 leading-relaxed">
              The platform is in early growth. The main focus is building a high-quality dataset
              of hybrid performance benchmarks and improving the product experience.
            </p>
          </section>
        </div>
      </main>
    );
  }