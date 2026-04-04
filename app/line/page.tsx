const services = [
    {
      title: "Emergency Direct Runs",
      description:
        "Urgent parts, documents, tools, and time-sensitive shipments picked up quickly and delivered direct without unnecessary stops.",
    },
    {
      title: "Same-Day Delivery",
      description:
        "Reliable same-day courier service for businesses that need dependable transport across Woodstock and throughout Ontario.",
    },
    {
      title: "After-Hours Service",
      description:
        "Evening, weekend, and after-hours support for deliveries that cannot wait until the next business day.",
    },
  ];
  
  const industries = [
    "Factories",
    "Machine Shops",
    "Automotive",
    "Manufacturing",
    "Warehousing",
    "Legal Offices",
    "Medical Offices",
    "Industrial Suppliers",
  ];
  
  const processSteps = [
    {
      step: "01",
      title: "Request Service",
      text: "Call, text, or send your delivery details through the quote form.",
    },
    {
      step: "02",
      title: "Fast Confirmation",
      text: "We confirm availability and timing quickly so your shipment can get moving.",
    },
    {
      step: "03",
      title: "Direct Delivery",
      text: "Your shipment is picked up and delivered with urgency, care, and clear communication.",
    },
  ];
  
  const faqs = [
    {
      q: "What kind of deliveries do you handle?",
      a: "Line Saver Express handles urgent business deliveries including industrial parts, documents, tools, and other time-sensitive shipments.",
    },
    {
      q: "Where do you operate?",
      a: "We are based in Woodstock, Ontario and provide service locally and across Ontario depending on the delivery requirements.",
    },
    {
      q: "Do you offer after-hours service?",
      a: "Yes. After-hours and urgent delivery support is available for businesses that cannot afford unnecessary delays.",
    },
    {
      q: "How do I request a quote?",
      a: "You can call, text, or submit your details through the contact form and we will respond as quickly as possible.",
    },
  ];
  
  function SectionHeading({
    eyebrow,
    title,
    description,
  }: {
    eyebrow?: string;
    title: string;
    description?: string;
  }) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow ? (
          <div className="mb-4 inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-300">
            {eyebrow}
          </div>
        ) : null}
  
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h2>
  
        {description ? (
          <p className="mt-5 text-base leading-7 text-zinc-300 sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
    );
  }
  
  function CheckIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 text-orange-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  
  function PhoneIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.79.62 2.64a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.44-1.23a2 2 0 0 1 2.11-.45c.85.29 1.74.5 2.64.62A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }
  
  function BoltIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6"
        fill="currentColor"
      >
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
      </svg>
    );
  }
  
  function TruckIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 5h13v10H1z" />
        <path d="M14 8h4l3 3v4h-7z" />
        <circle cx="5.5" cy="17.5" r="1.5" />
        <circle cx="18.5" cy="17.5" r="1.5" />
      </svg>
    );
  }
  
  function ClockIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    );
  }
  
  export default function LineSaverExpressPage() {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#121212_0%,#0a0a0a_100%)]">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:72px_72px]" />
          </div>
  
          <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
  
          <div className="relative mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                  <BoltIcon />
                  When downtime isn’t an option
                </div>
  
                <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Emergency courier service for urgent industrial deliveries
                </h1>
  
                <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                  Fast pickup, direct delivery, and dependable service for
                  businesses that need critical shipments moved without delay.
                  Based in Woodstock, Ontario and serving customers across the
                  province.
                </p>
  
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <a
                    href="#contact"
                    className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-4 text-base font-semibold text-black transition hover:bg-orange-400"
                  >
                    Request a Quote
                  </a>
  
                  <a
                    href="tel:5195360803"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-4 text-base font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
                  >
                    <PhoneIcon />
                    (519) 536-0803
                  </a>
                </div>
  
                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                      <BoltIcon />
                    </div>
                    <div className="mt-4 text-base font-semibold">Fast Response</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Quick pickup arrangements for urgent delivery needs.
                    </p>
                  </div>
  
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                      <TruckIcon />
                    </div>
                    <div className="mt-4 text-base font-semibold">Direct Service</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Shipments moved efficiently with no wasted stops.
                    </p>
                  </div>
  
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                      <ClockIcon />
                    </div>
                    <div className="mt-4 text-base font-semibold">
                      After-Hours Support
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Service available when the job cannot wait.
                    </p>
                  </div>
                </div>
              </div>
  
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-8">
                <div className="rounded-[22px] border border-white/10 bg-[#111111] p-6 sm:p-7">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
                    Immediate Service
                  </div>
  
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Need a delivery moved right away?
                  </h2>
  
                  <p className="mt-4 text-base leading-7 text-zinc-300">
                    Call or text now for urgent delivery support. We work with
                    businesses that need dependable courier service for
                    time-sensitive shipments.
                  </p>
  
                  <div className="mt-8 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Phone
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-white">
                        (519) 536-0803
                      </div>
                    </div>
  
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Email
                      </div>
                      <div className="mt-1 break-all text-base font-medium text-white">
                        contact@linesaverexpress.ca
                      </div>
                    </div>
  
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Service Area
                      </div>
                      <div className="mt-1 text-base font-medium text-white">
                        Woodstock, Ontario • Serving all of Ontario
                      </div>
                    </div>
                  </div>
  
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a
                      href="tel:5195360803"
                      className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-orange-400"
                    >
                      Call Now
                    </a>
                    <a
                      href="#contact"
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Send Request
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
  
        <section id="services" className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
            <SectionHeading
              eyebrow="Services"
              title="Urgent delivery support for time-sensitive business needs"
              description="Line Saver Express provides fast, dependable courier service for businesses that need shipments moved with urgency and professionalism."
            />
  
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div
                  key={service.title}
                  className="rounded-[24px] border border-white/10 bg-zinc-900/70 p-6"
                >
                  <h3 className="text-xl font-semibold text-white">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
  
        <section className="border-y border-white/10 bg-zinc-950 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Built for businesses that cannot afford delays
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
                  We serve companies and professionals that need urgent shipments
                  handled properly, with fast response times and dependable
                  delivery from pickup to drop-off.
                </p>
  
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    "Fast pickup response",
                    "Direct delivery service",
                    "Professional communication",
                    "Woodstock-based, Ontario coverage",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <CheckIcon />
                      <p className="text-sm leading-7 text-zinc-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
  
              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {industries.map((industry) => (
                    <div
                      key={industry}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-sm font-medium text-zinc-200"
                    >
                      {industry}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
  
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
            <SectionHeading
              eyebrow="How It Works"
              title="Simple process. Fast turnaround."
              description="Getting a delivery moving should be straightforward. We keep the process quick and clear from the first call to final drop-off."
            />
  
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {processSteps.map((item) => (
                <div
                  key={item.step}
                  className="rounded-[24px] border border-white/10 bg-zinc-900/70 p-6"
                >
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-400">
                    Step {item.step}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
  
        <section className="border-y border-white/10 bg-zinc-950 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
            <div className="rounded-[30px] border border-orange-500/20 bg-[linear-gradient(135deg,rgba(255,115,0,0.12),rgba(255,255,255,0.02))] p-8 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
                    Need service now?
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Call or text for immediate delivery support
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-200">
                    For urgent runs, after-hours requests, and same-day delivery
                    needs, contact Line Saver Express directly.
                  </p>
                </div>
  
                <a
                  href="tel:5195360803"
                  className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-7 py-4 text-base font-semibold text-black transition hover:bg-orange-400"
                >
                  (519) 536-0803
                </a>
              </div>
            </div>
          </div>
        </section>
  
        <section id="faq" className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-10">
            <SectionHeading
              eyebrow="FAQ"
              title="Common questions"
              description="A few quick answers about service, coverage, and how to get started."
            />
  
            <div className="mt-12 space-y-4">
              {faqs.map((item) => (
                <div
                  key={item.q}
                  className="rounded-[22px] border border-white/10 bg-zinc-900/70 p-6"
                >
                  <h3 className="text-lg font-semibold text-white">{item.q}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
  
        <section
          id="contact"
          className="border-t border-white/10 bg-zinc-950 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <div className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
                  Contact
                </div>
  
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Request service or a quote
                </h2>
  
                <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
                  Call, text, or send your delivery details through the form. We
                  respond quickly and keep the process straightforward.
                </p>
  
                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Email
                    </div>
                    <div className="mt-2 text-base font-medium text-white break-all">
                      contact@linesaverexpress.ca
                    </div>
                  </div>
  
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Phone
                    </div>
                    <div className="mt-2 text-base font-medium text-white">
                      (519) 536-0803
                    </div>
                  </div>
  
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Location
                    </div>
                    <div className="mt-2 text-base font-medium text-white">
                      Woodstock, Ontario
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      Serving all of Ontario
                    </div>
                  </div>
                </div>
              </div>
  
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
                <h3 className="text-2xl font-semibold tracking-tight text-white">
                  Send a request
                </h3>
  
                <form className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      First Name
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-orange-500/40"
                      placeholder="First name"
                    />
                  </div>
  
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Last Name
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-orange-500/40"
                      placeholder="Last name"
                    />
                  </div>
  
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-orange-500/40"
                      placeholder="Email"
                    />
                  </div>
  
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Phone
                    </label>
                    <input
                      type="tel"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-orange-500/40"
                      placeholder="Phone"
                    />
                  </div>
  
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Message
                    </label>
                    <textarea
                      rows={5}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-orange-500/40"
                      placeholder="Tell us what needs to be picked up, where it needs to go, and how urgent it is."
                    />
                  </div>
  
                  <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-4 text-base font-semibold text-black transition hover:bg-orange-400"
                    >
                      Submit Request
                    </button>
  
                    <a
                      href="tel:5195360803"
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/10"
                    >
                      Call Now
                    </a>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
  
        <footer className="border-t border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-lg font-semibold text-white">
                  Line Saver Express
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  Emergency courier service for industrial deliveries
                </div>
              </div>
  
              <div className="flex flex-col gap-1 text-sm text-zinc-400 lg:text-right">
                <div>Woodstock, Ontario</div>
                <div>Serving all of Ontario</div>
                <a href="mailto:contact@linesaverexpress.ca" className="hover:text-white">
                  contact@linesaverexpress.ca
                </a>
                <a href="tel:5195360803" className="hover:text-white">
                  (519) 536-0803
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    );
  }