import Link from "next/link";

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Methodology</h1>
      <p className="mt-4 text-white/70 leading-relaxed">
        Strendex estimates hybrid performance using a combination of strength and endurance inputs.
        Your results are intended for benchmarking and comparison — not medical, training, or safety advice.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-white">Inputs</h2>
          <ul className="mt-2 list-disc pl-5 text-white/70 space-y-2">
            <li>Bodyweight</li>
            <li>Bench Press</li>
            <li>Squat</li>
            <li>Deadlift</li>
            <li>5K time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Outputs</h2>
          <ul className="mt-2 list-disc pl-5 text-white/70 space-y-2">
            <li>HQ Score (hybrid score)</li>
            <li>Rank band</li>
            <li>Archetype</li>
            <li>Percentile estimate (based on current dataset)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Percentiles</h2>
          <p className="mt-2 text-white/70 leading-relaxed">
            Percentiles are computed relative to the existing submissions in the Strendex dataset.
            Early on, the dataset may be small, so percentile estimates will become more accurate as
            more athletes submit data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Transparency</h2>
          <p className="mt-2 text-white/70 leading-relaxed">
            Strendex is designed to be simple, fast, and comparable. If you have feedback on the scoring,
            reach out via the <Link className="text-white underline" href="/contact">contact page</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}