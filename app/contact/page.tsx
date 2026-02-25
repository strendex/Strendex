export default function ContactPage() {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Contact</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          For feedback, bugs, removal requests, or partnerships, reach out anytime.
        </p>
  
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/70">Email</div>
          <a
            className="mt-2 inline-block text-white underline"
            href="mailto:hello@strendex.com?subject=Strendex%20Support"
          >
            hello@strendex.com
          </a>
  
          <div className="mt-6 text-sm text-white/70">Quick message</div>
          <a
            className="mt-2 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            href="mailto:hello@strendex.com?subject=Strendex%20Feedback&body=Hey%20Strendex%2C%0A%0AHere%E2%80%99s%20my%20feedback%3A%0A"
          >
            Email feedback
          </a>
        </div>
      </main>
    );
  }