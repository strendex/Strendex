import Link from "next/link";

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Methodology</h1>
      <p className="mt-4 text-white/70 leading-relaxed">
        Strendex benchmarks strength and endurance together, so you can see how both sides of your
        training compare. Results are for performance benchmarking and comparison. They are not
        medical, safety or individual training advice.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-white">Inputs</h2>
          <ul className="mt-2 list-disc pl-5 text-white/70 space-y-2">
            <li>Bodyweight</li>
            <li>Bench press</li>
            <li>Squat</li>
            <li>Deadlift</li>
            <li>A recent run over 3 miles, 5K, 10K, half marathon or marathon</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">How the Hybrid Score works</h2>
          <p className="mt-2 text-white/70 leading-relaxed">
            Your lifts are measured relative to your bodyweight to form the strength side. Your run is
            converted to a common endurance scale, so every supported distance is judged on the same
            terms. Each side is then placed within the Strendex reference dataset, giving you a
            Strength Percentile and an Endurance Percentile.
          </p>
          <div className="mt-4 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 font-mono text-sm text-white">
            Hybrid Score = 50% Strength Percentile + 50% Endurance Percentile
          </div>
          <p className="mt-4 text-white/70 leading-relaxed">
            The Hybrid Score runs from 0 to 100. It is the average of two percentiles, not a percentile
            itself: a Hybrid Score of 70 does not mean you outperform 70% of athletes. Your two
            percentiles show where you stand on each side; the Hybrid Score brings them together. See{" "}
            <Link className="text-white underline" href="/how-scoring-works">how scoring works</Link>{" "}
            for a worked example.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">What your result includes</h2>
          <ul className="mt-2 list-disc pl-5 text-white/70 space-y-2">
            <li>Hybrid Score</li>
            <li>Strength and endurance percentiles</li>
            <li>Tier</li>
            <li>Athlete type</li>
            <li>Your strength and endurance balance, and what it means</li>
            <li>A shareable athlete card</li>
            <li>Athlete Review, a deeper written breakdown of your result</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Reference dataset</h2>
          <p className="mt-2 text-white/70 leading-relaxed">
            Percentiles are currently measured against a provisional baseline of 519 entries, drawn
            from legacy Strendex records created before the current data governance system.
          </p>
          <p className="mt-3 text-white/70 leading-relaxed">
            Those records contain a mix of early seeded, simulated athlete data and real self-reported
            submissions, and they do not reliably show which entry came from which source. For that
            reason, Strendex does not describe the baseline as 519 verified or known-real athletes.
          </p>
          <p className="mt-3 text-white/70 leading-relaxed">
            The baseline is frozen, so new submissions do not quietly change the population your score
            is measured against. It is a provisional starting benchmark while cleaner observed athlete
            data is collected.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Reference dataset and rankings</h2>
          <p className="mt-2 text-white/70 leading-relaxed">
            These are separate systems. The reference dataset is what your percentiles are measured
            against. Rankings are made up of results athletes choose to publish.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Feedback</h2>
          <p className="mt-2 text-white/70 leading-relaxed">
            If you have feedback on the scoring, reach out via the{" "}
            <Link className="text-white underline" href="/contact">contact page</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
