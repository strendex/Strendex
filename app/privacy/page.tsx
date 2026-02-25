export default function PrivacyPage() {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          This Privacy Policy explains what information Strendex collects and how it is used.
        </p>
  
        <div className="mt-10 space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white">Information you provide</h2>
            <p className="mt-2">
              When you use the tool, you may submit performance metrics such as bodyweight, lifts, and 5K time,
              along with a display name. Submissions may be used to generate rankings and percentiles.
            </p>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">How we use information</h2>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li>To calculate your results and display them in the app</li>
              <li>To generate leaderboard rankings and percentile estimates</li>
              <li>To improve the product and benchmarking accuracy</li>
            </ul>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">Cookies & analytics</h2>
            <p className="mt-2">
              Strendex may use basic analytics and local storage to improve the experience
              (for example, remembering your display name on your device).
            </p>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">Data retention</h2>
            <p className="mt-2">
              Submissions may be stored to power the dataset and rankings. If you would like a submission removed,
              contact us and include the display name and approximate submission time.
            </p>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">Contact</h2>
            <p className="mt-2">
              For privacy questions or removal requests, contact us via the Contact page.
            </p>
          </section>
        </div>
      </main>
    );
  }