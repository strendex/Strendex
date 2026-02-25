export default function TermsPage() {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          By using Strendex, you agree to the terms below.
        </p>
  
        <div className="mt-10 space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white">Benchmarking only</h2>
            <p className="mt-2">
              Strendex is provided for informational and benchmarking purposes only. It does not provide medical,
              training, safety, or professional advice.
            </p>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">User submissions</h2>
            <p className="mt-2">
              You are responsible for the accuracy of the information you submit. Submissions may be displayed
              on leaderboards and used to compute percentiles.
            </p>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">Acceptable use</h2>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li>No unlawful use</li>
              <li>No attempts to abuse, spam, or manipulate the rankings</li>
              <li>No harmful or offensive display names</li>
            </ul>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">Changes</h2>
            <p className="mt-2">
              Strendex may update these terms over time as the platform evolves.
            </p>
          </section>
        </div>
      </main>
    );
  }