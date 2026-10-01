export default function AboutPage() {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-white">About Strendex</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          Strendex is a hybrid performance benchmarking platform built for athletes who train
          both strength and endurance. Enter your bodyweight, lifts and a recent run to see your
          Hybrid Score, strength and endurance profile, athlete type, and shareable result.
        </p>
  
        <div className="mt-10 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-white">Why Strendex exists</h2>
            <p className="mt-2 text-white/70 leading-relaxed">
              Strength and endurance are usually measured separately. Strendex brings both sides of
              performance into one profile so hybrid athletes can understand how they compare
              together.
            </p>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">What you can do</h2>
            <ul className="mt-2 list-disc pl-5 text-white/70 space-y-2">
              <li>Calculate your Hybrid Score from strength and endurance performance.</li>
              <li>See your strength and endurance percentiles, tier, and athlete type.</li>
              <li>Understand the balance between the two sides of your profile.</li>
              <li>Export a shareable athlete card.</li>
              <li>Go deeper with Athlete Review.</li>
            </ul>
          </section>
  
          <section>
            <h2 className="text-xl font-semibold text-white">Current stage</h2>
            <p className="mt-2 text-white/70 leading-relaxed">
              Strendex is early. The current focus is improving the quality of the benchmark,
              collecting stronger real-world athlete data, and making the product more useful as
              more athletes test.
            </p>
          </section>
        </div>
      </main>
    );
  }