"use client";

import { useEffect, useRef } from "react";

export default function JoyWithinPage() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const modules = [
    {
      num: "01",
      title: "The Art of Presence",
      desc: "Learn to anchor yourself in the now. Release the grip of overthinking and discover stillness through breath-based practices.",
    },
    {
      num: "02",
      title: "Rooting Into the Body",
      desc: "Reconnect with your physical self through somatic awareness. Tension holds stories — we'll learn to gently release them.",
    },
    {
      num: "03",
      title: "The Inner Landscape",
      desc: "Map your emotional world with compassion. Identify patterns, triggers, and the quiet wisdom beneath your reactions.",
    },
    {
      num: "04",
      title: "Cultivating Deep Rest",
      desc: "Rest is not laziness — it is medicine. Explore yoga nidra, restorative rituals, and the healing power of true stillness.",
    },
    {
      num: "05",
      title: "Nourishing Your Energy",
      desc: "Understand your natural rhythms and build a lifestyle that replenishes, not depletes. Energy is your most sacred resource.",
    },
    {
      num: "06",
      title: "Living with Intention",
      desc: "Close the loop with a personal growth practice you can sustain for life. Set values-aligned goals and move forward with clarity.",
    },
  ];

  const testimonials = [
    {
      quote:
        "Joy's course completely changed the way I start my mornings. I've gone from anxious and scattered to calm and grounded — in just six weeks.",
      name: "Marisela V.",
      role: "Yoga Teacher, Vancouver",
    },
    {
      quote:
        "I've tried other mindfulness programs but nothing clicked until Joy. Her voice, her pace, her depth — it feels like she truly sees you.",
      name: "Thomas H.",
      role: "Software Engineer, Berlin",
    },
    {
      quote:
        "The somatic module alone was worth everything. I didn't realize how much I'd been living from the neck up until this course.",
      name: "Priya R.",
      role: "Therapist, Melbourne",
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --cream:    #f7f3ec;
          --linen:    #ede8df;
          --sage:     #8aab89;
          --sage-mid: #6a9169;
          --forest:   #3b5e3a;
          --deep:     #2a4229;
          --bark:     #7c5c3e;
          --warm-mid: #b89878;
          --gold:     #c8a96a;
          --text:     #2d2a25;
          --muted:    #8a8278;
        }

        body { background: var(--cream); }

        .page {
          font-family: 'DM Sans', sans-serif;
          color: var(--text);
          background: var(--cream);
          overflow-x: hidden;
        }

        .reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.75s ease, transform 0.75s ease;
        }
        .reveal.in-view {
          opacity: 1;
          transform: translateY(0);
        }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }
        .reveal-delay-4 { transition-delay: 0.4s; }
        .reveal-delay-5 { transition-delay: 0.5s; }

        .hero {
          min-height: 100vh;
          background: var(--deep);
          display: grid;
          grid-template-columns: 1fr 1fr;
          position: relative;
          overflow: hidden;
        }
        .hero-texture {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          pointer-events: none;
        }
        .hero-left {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 100px 80px 100px 120px;
          position: relative;
          z-index: 2;
        }
        .hero-right {
          position: relative;
          overflow: hidden;
        }
        .hero-img-wrap {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--forest) 0%, #1e3a1e 60%, #0d200d 100%);
        }
        .hero-img-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, var(--deep) 0%, transparent 30%);
          z-index: 1;
        }
        .hero-leaf {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%;
          background: radial-gradient(ellipse at 40% 40%, rgba(138,171,137,0.25), rgba(59,94,58,0.1));
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 0;
        }
        .hero-circle-decor {
          position: absolute;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          border: 1px solid rgba(138,171,137,0.2);
          top: 15%;
          right: -60px;
          z-index: 0;
        }
        .hero-circle-decor-2 {
          position: absolute;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          border: 1px solid rgba(200,169,106,0.15);
          bottom: 18%;
          left: 40px;
          z-index: 0;
        }
        .eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .eyebrow::before {
          content: '';
          width: 28px;
          height: 1px;
          background: var(--gold);
          display: block;
        }
        .hero h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 78px;
          font-weight: 300;
          line-height: 1.04;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .hero h1 em {
          font-style: italic;
          color: var(--sage);
        }
        .hero-sub {
          margin-top: 28px;
          font-size: 17px;
          font-weight: 300;
          line-height: 1.75;
          color: rgba(255,255,255,0.6);
          max-width: 420px;
        }
        .hero-cta-row {
          margin-top: 48px;
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: var(--sage);
          color: var(--deep);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.04em;
          padding: 16px 34px;
          border-radius: 100px;
          border: none;
          cursor: pointer;
          transition: background 0.25s ease, transform 0.2s ease;
          text-decoration: none;
        }
        .btn-primary:hover { background: #9dbe9c; transform: translateY(-2px); }
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.55);
          font-size: 14px;
          font-weight: 400;
          cursor: pointer;
          border: none;
          background: none;
          transition: color 0.2s ease;
          text-decoration: none;
        }
        .btn-ghost:hover { color: rgba(255,255,255,0.9); }
        .hero-stats {
          margin-top: 72px;
          display: flex;
          gap: 48px;
          padding-top: 48px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .hero-stat-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 38px;
          font-weight: 400;
          color: #fff;
          line-height: 1;
        }
        .hero-stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.06em;
          margin-top: 6px;
        }

        .trust-bar {
          background: var(--linen);
          border-top: 1px solid rgba(0,0,0,0.06);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          padding: 20px 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 56px;
        }
        .trust-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--muted);
          font-weight: 400;
          white-space: nowrap;
        }
        .trust-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--sage);
          flex-shrink: 0;
        }

        .intro {
          padding: 120px 120px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 100px;
          align-items: center;
        }
        .intro-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--sage-mid);
          margin-bottom: 20px;
        }
        .intro h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 54px;
          font-weight: 300;
          line-height: 1.12;
          letter-spacing: -0.01em;
          color: var(--deep);
        }
        .intro h2 em { font-style: italic; color: var(--bark); }
        .intro-right p {
          font-size: 17px;
          line-height: 1.85;
          color: #5a5550;
          font-weight: 300;
        }
        .intro-right p + p { margin-top: 20px; }
        .intro-pill-row {
          margin-top: 36px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid var(--sage);
          color: var(--forest);
          font-size: 13px;
          font-weight: 400;
          padding: 8px 18px;
          border-radius: 100px;
          background: rgba(138,171,137,0.07);
        }

        .modules-section {
          background: var(--deep);
          padding: 120px;
        }
        .section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 72px;
        }
        .section-header-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 18px;
        }
        .section-header h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 52px;
          font-weight: 300;
          color: #fff;
          line-height: 1.1;
        }
        .section-header-sub {
          font-size: 15px;
          color: rgba(255,255,255,0.4);
          max-width: 300px;
          line-height: 1.7;
          text-align: right;
          font-weight: 300;
        }
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
        }
        .module-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          padding: 44px 38px;
          transition: background 0.25s ease, border-color 0.25s ease;
          cursor: default;
          position: relative;
          overflow: hidden;
        }
        .module-card::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--sage);
          transition: width 0.4s ease;
        }
        .module-card:hover::after { width: 100%; }
        .module-card:hover {
          background: rgba(138,171,137,0.06);
          border-color: rgba(138,171,137,0.2);
        }
        .module-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px;
          font-weight: 400;
          color: var(--gold);
          letter-spacing: 0.1em;
          margin-bottom: 20px;
        }
        .module-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 400;
          color: #fff;
          line-height: 1.25;
          margin-bottom: 16px;
        }
        .module-desc {
          font-size: 14px;
          line-height: 1.8;
          color: rgba(255,255,255,0.45);
          font-weight: 300;
        }

        .instructor {
          padding: 120px;
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 100px;
          align-items: center;
          background: var(--cream);
        }
        .instructor-img {
          aspect-ratio: 4/5;
          border-radius: 40% 60% 55% 45% / 45% 50% 50% 55%;
          background: linear-gradient(160deg, var(--sage) 0%, var(--forest) 60%, var(--deep) 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .instructor-img-inner {
          font-family: 'Cormorant Garamond', serif;
          font-size: 80px;
          color: rgba(255,255,255,0.15);
          font-style: italic;
          user-select: none;
        }
        .instructor-badge {
          position: absolute;
          bottom: -10px;
          right: -10px;
          background: var(--cream);
          border-radius: 20px;
          padding: 18px 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.12);
          border: 1px solid rgba(0,0,0,0.06);
        }
        .badge-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 36px;
          font-weight: 400;
          color: var(--deep);
          line-height: 1;
        }
        .badge-label {
          font-size: 11px;
          color: var(--muted);
          margin-top: 4px;
          letter-spacing: 0.04em;
        }
        .instructor-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--sage-mid);
          margin-bottom: 16px;
        }
        .instructor h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 52px;
          font-weight: 300;
          line-height: 1.1;
          color: var(--deep);
        }
        .instructor-name {
          font-size: 18px;
          font-weight: 500;
          color: var(--bark);
          margin-top: 6px;
          margin-bottom: 28px;
          letter-spacing: 0.02em;
        }
        .instructor p {
          font-size: 16px;
          line-height: 1.85;
          color: #5a5550;
          font-weight: 300;
        }
        .instructor p + p { margin-top: 18px; }
        .credentials {
          margin-top: 36px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .credential-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: var(--forest);
        }
        .credential-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(138,171,137,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .testimonials {
          background: var(--linen);
          padding: 120px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .testimonials-header {
          text-align: center;
          margin-bottom: 72px;
        }
        .testimonials-header .section-header-label {
          display: block;
          text-align: center;
        }
        .testimonials-header h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 52px;
          font-weight: 300;
          color: var(--deep);
        }
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }
        .testimonial-card {
          background: var(--cream);
          border-radius: 24px;
          padding: 44px 38px;
          border: 1px solid rgba(0,0,0,0.06);
          position: relative;
        }
        .quote-mark {
          font-family: 'Cormorant Garamond', serif;
          font-size: 72px;
          line-height: 1;
          color: var(--sage);
          opacity: 0.4;
          margin-bottom: -16px;
        }
        .testimonial-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 21px;
          font-weight: 300;
          font-style: italic;
          line-height: 1.65;
          color: var(--deep);
          margin-bottom: 28px;
        }
        .testimonial-footer {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 24px;
          border-top: 1px solid rgba(0,0,0,0.07);
        }
        .testimonial-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--sage), var(--forest));
          flex-shrink: 0;
        }
        .testimonial-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--deep);
        }
        .testimonial-role {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .stars { color: var(--gold); font-size: 12px; margin-bottom: 4px; letter-spacing: 2px; }

        .includes {
          padding: 120px;
          background: var(--cream);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 100px;
          align-items: center;
        }
        .includes-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--sage-mid);
          margin-bottom: 18px;
        }
        .includes h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 52px;
          font-weight: 300;
          color: var(--deep);
          line-height: 1.1;
          margin-bottom: 16px;
        }
        .includes-sub {
          font-size: 16px;
          color: #5a5550;
          line-height: 1.8;
          font-weight: 300;
          margin-bottom: 40px;
        }
        .includes-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .include-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          border-radius: 14px;
          background: rgba(138,171,137,0.06);
          border: 1px solid rgba(138,171,137,0.15);
        }
        .include-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--sage);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .include-text { font-size: 14px; color: var(--forest); font-weight: 400; }
        .include-count { font-size: 12px; color: var(--muted); margin-top: 2px; }

        .pricing-card {
          background: var(--deep);
          border-radius: 32px;
          padding: 54px 50px;
          position: relative;
          overflow: hidden;
        }
        .pricing-card::before {
          content: '';
          position: absolute;
          top: -80px;
          right: -80px;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(138,171,137,0.12), transparent 70%);
          pointer-events: none;
        }
        .pricing-badge {
          display: inline-flex;
          background: var(--gold);
          color: var(--deep);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 6px 16px;
          border-radius: 100px;
          margin-bottom: 28px;
        }
        .pricing-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 34px;
          font-weight: 300;
          color: #fff;
          margin-bottom: 8px;
        }
        .pricing-price {
          font-family: 'Cormorant Garamond', serif;
          font-size: 80px;
          font-weight: 300;
          color: #fff;
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .pricing-price sup {
          font-size: 32px;
          vertical-align: top;
          margin-top: 16px;
          display: inline-block;
        }
        .pricing-note {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 36px;
          margin-top: 8px;
        }
        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 40px;
        }
        .pricing-features li {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: rgba(255,255,255,0.65);
          font-weight: 300;
        }
        .check {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(138,171,137,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: var(--sage);
          flex-shrink: 0;
        }
        .btn-enroll {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--sage);
          color: var(--deep);
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          padding: 18px 24px;
          border-radius: 100px;
          border: none;
          cursor: pointer;
          transition: background 0.25s ease, transform 0.2s ease;
          letter-spacing: 0.03em;
        }
        .btn-enroll:hover { background: #9dbe9c; transform: translateY(-2px); }
        .pricing-guarantee {
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          margin-top: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .final-cta {
          background: linear-gradient(160deg, var(--forest) 0%, var(--deep) 100%);
          padding: 140px 120px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .final-cta::before {
          content: '';
          position: absolute;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 700px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(138,171,137,0.1), transparent 70%);
          pointer-events: none;
        }
        .final-cta-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .final-cta h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 72px;
          font-weight: 300;
          color: #fff;
          line-height: 1.08;
          letter-spacing: -0.02em;
          max-width: 760px;
          margin: 0 auto 28px;
        }
        .final-cta h2 em { font-style: italic; color: var(--sage); }
        .final-cta p {
          font-size: 17px;
          color: rgba(255,255,255,0.5);
          font-weight: 300;
          line-height: 1.8;
          max-width: 520px;
          margin: 0 auto 52px;
        }
        .final-cta-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .btn-outline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.7);
          background: transparent;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 400;
          padding: 16px 30px;
          border-radius: 100px;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
          text-decoration: none;
        }
        .btn-outline:hover { border-color: rgba(255,255,255,0.45); color: #fff; }
      `}</style>

      <div className="page">

        <section className="hero">
          <div className="hero-texture" />
          <div className="hero-left">
            <div className="eyebrow reveal">A 6-Week Mindfulness Course</div>
            <h1 className="reveal reveal-delay-1">
              Come <em>home</em><br />to yourself.
            </h1>
            <p className="hero-sub reveal reveal-delay-2">
              Joy Within is a transformative six-week journey through mindfulness, somatic healing, and personal growth — designed for those who are ready to stop rushing and start living.
            </p>
            <div className="hero-cta-row reveal reveal-delay-3">
              <a href="#" className="btn-primary">
                Begin Your Journey
                <span style={{ fontSize: 18 }}>→</span>
              </a>
              <a href="#" className="btn-ghost">
                <span style={{ fontSize: 16, opacity: 0.6 }}>▶</span>
                Watch preview
              </a>
            </div>
            <div className="hero-stats reveal reveal-delay-4">
              <div>
                <div className="hero-stat-num">2,400+</div>
                <div className="hero-stat-label">Students enrolled</div>
              </div>
              <div>
                <div className="hero-stat-num">4.9</div>
                <div className="hero-stat-label">Average rating</div>
              </div>
              <div>
                <div className="hero-stat-num">6</div>
                <div className="hero-stat-label">Weeks to transformation</div>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-img-wrap">
              <div className="hero-leaf" />
              <div className="hero-circle-decor" />
              <div className="hero-circle-decor-2" />
              <svg style={{ position: 'absolute', bottom: '8%', right: '6%', opacity: 0.18, zIndex: 1 }} width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M90 160 C90 160 30 130 20 80 C10 30 60 10 90 40 C120 10 170 30 160 80 C150 130 90 160 90 160Z" stroke="#8aab89" strokeWidth="1.5" fill="none"/>
                <line x1="90" y1="40" x2="90" y2="160" stroke="#8aab89" strokeWidth="1" strokeDasharray="4 4"/>
                <path d="M90 80 C90 80 55 65 50 45" stroke="#8aab89" strokeWidth="1"/>
                <path d="M90 100 C90 100 125 85 130 65" stroke="#8aab89" strokeWidth="1"/>
                <path d="M90 120 C90 120 58 108 52 90" stroke="#8aab89" strokeWidth="1"/>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.3em', textTransform: 'uppercase', fontStyle: 'italic' }}>Joy Within</div>
                <div style={{ width: 80, height: 1, background: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 108, color: 'rgba(255,255,255,0.06)', fontWeight: 300, lineHeight: 1, userSelect: 'none' }}>JW</div>
              </div>
            </div>
            <div className="hero-img-overlay" />
          </div>
        </section>

        <div className="trust-bar">
          {["Lifetime access", "30-day money-back guarantee", "New cohort every month", "Live Q&A sessions included", "Private community access"].map((t) => (
            <div className="trust-item" key={t}>
              <span className="trust-dot" />
              {t}
            </div>
          ))}
        </div>

        <section className="intro">
          <div>
            <div className="intro-label reveal">What Is Joy Within</div>
            <h2 className="reveal reveal-delay-1">
              Not another<br /><em>self-help</em> program.
            </h2>
          </div>
          <div className="reveal reveal-delay-2">
            <p>Joy Within is a deeply personal course built around one belief: that sustainable growth doesn't come from pushing harder — it comes from listening more carefully. This isn't about productivity hacks or morning routine checklists.</p>
            <p>Over six weeks you'll move through a structured, compassionate curriculum covering breathwork, somatic awareness, emotional literacy, and values-based living. Each week builds on the last, creating a genuine foundation — not a temporary high.</p>
            <div className="intro-pill-row">
              {["Self-paced", "Evidence-informed", "Community supported", "Lifetime access"].map((p) => (
                <span className="pill" key={p}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)', flexShrink: 0, display: 'inline-block' }} />
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="modules-section">
          <div className="section-header reveal">
            <div>
              <div className="section-header-label">The Curriculum</div>
              <h2>Six weeks.<br />Six transformations.</h2>
            </div>
            <div className="section-header-sub">
              Each module is a self-contained world — and together they create a complete shift in how you live.
            </div>
          </div>
          <div className="modules-grid">
            {modules.map((m, i) => (
              <div className={`module-card reveal reveal-delay-${Math.min(i + 1, 5)}`} key={m.num}>
                <div className="module-num">{m.num}</div>
                <div className="module-title">{m.title}</div>
                <div className="module-desc">{m.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="instructor">
          <div className="reveal">
            <div className="instructor-img">
              <div className="instructor-img-inner">J</div>
              <div className="instructor-badge">
                <div className="badge-num">8+</div>
                <div className="badge-label">Years teaching</div>
              </div>
            </div>
          </div>
          <div>
            <div className="instructor-label reveal">Your Guide</div>
            <h2 className="reveal reveal-delay-1">Meet Joy<br />Fairweather</h2>
            <div className="instructor-name reveal reveal-delay-1">Mindfulness Teacher & Somatic Coach</div>
            <p className="reveal reveal-delay-2">
              Joy began her mindfulness journey after a burnout in her late twenties forced her to slow down and ask bigger questions. What started as a desperate search for stillness became an eight-year vocation — training across traditions from vipassana to somatic experiencing to Tibetan Buddhist practice.
            </p>
            <p className="reveal reveal-delay-2">
              She's taught over 2,400 students across 40 countries, and her approach is known for being warm, grounded, and deeply practical. Joy doesn't teach from a pedestal — she teaches from the path.
            </p>
            <div className="credentials reveal reveal-delay-3">
              {[
                { icon: "🌿", text: "Certified Mindfulness-Based Stress Reduction (MBSR) teacher" },
                { icon: "🧘", text: "Trained in Somatic Experiencing (SE) and trauma-informed care" },
                { icon: "📖", text: "Featured in Mindful Magazine and Yoga Journal" },
              ].map((c) => (
                <div className="credential-item" key={c.text}>
                  <div className="credential-icon">{c.icon}</div>
                  <span style={{ fontSize: 14 }}>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="testimonials">
          <div className="testimonials-header reveal">
            <div className="section-header-label">Student Stories</div>
            <h2>What people are saying</h2>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <div className={`testimonial-card reveal reveal-delay-${i + 1}`} key={t.name}>
                <div className="stars">★★★★★</div>
                <div className="quote-mark">&ldquo;</div>
                <div className="testimonial-text">{t.quote}</div>
                <div className="testimonial-footer">
                  <div className="testimonial-avatar" />
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="includes">
          <div>
            <div className="includes-label reveal">What's Inside</div>
            <h2 className="reveal reveal-delay-1">Everything you<br />need to begin.</h2>
            <p className="includes-sub reveal reveal-delay-2">
              No upsells. No hidden tiers. Joy Within is a complete program — everything below is included from day one.
            </p>
            <div className="includes-list">
              {[
                { icon: "🎥", label: "36 guided video lessons", count: "6 per module, ~20 min each" },
                { icon: "🧘", label: "18 audio meditations", count: "Downloadable MP3s for offline use" },
                { icon: "📓", label: "6 deep-dive workbooks", count: "Printable PDF format" },
                { icon: "💬", label: "Monthly live Q&A with Joy", count: "Recorded for on-demand replay" },
                { icon: "🌳", label: "Private community forum", count: "Lifetime access, 2,400+ members" },
                { icon: "🔄", label: "Lifetime course access", count: "Including all future updates" },
              ].map((item, i) => (
                <div className={`include-row reveal reveal-delay-${Math.min(i + 1, 5)}`} key={item.label}>
                  <div className="include-icon">{item.icon}</div>
                  <div>
                    <div className="include-text">{item.label}</div>
                    <div className="include-count">{item.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal reveal-delay-2">
            <div className="pricing-card">
              <div className="pricing-badge">Most popular</div>
              <div className="pricing-name">Joy Within — Full Program</div>
              <div className="pricing-price"><sup>$</sup>197</div>
              <div className="pricing-note">One-time payment · Lifetime access</div>
              <ul className="pricing-features">
                {[
                  "All 6 modules + 36 video lessons",
                  "18 downloadable guided meditations",
                  "Printable workbooks for each week",
                  "Monthly live Q&A with Joy",
                  "Private community lifetime access",
                  "30-day money-back guarantee",
                ].map((f) => (
                  <li key={f}><span className="check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="btn-enroll">Enroll Now — $197</button>
              <div className="pricing-guarantee">
                <span>🛡</span> 30-day money-back guarantee. No questions asked.
              </div>
            </div>
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              Or <a href="#" style={{ color: 'var(--sage-mid)', textDecoration: 'underline' }}>3 monthly payments of $75</a> — same full access.
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="final-cta-label reveal">
            <span style={{ width: 24, height: 1, background: 'var(--gold)', display: 'inline-block' }} />
            Your next chapter is waiting
          </div>
          <h2 className="reveal reveal-delay-1">
            The quiet life you've been<br />craving is <em>possible.</em>
          </h2>
          <p className="reveal reveal-delay-2">
            Thousands of people have found their footing with Joy Within. The only thing between you and that stillness is a single decision.
          </p>
          <div className="final-cta-buttons reveal reveal-delay-3">
            <a href="#" className="btn-primary" style={{ padding: '18px 44px', fontSize: 15 }}>
              Start Your Journey Today
            </a>
            <a href="#" className="btn-outline">Learn more ↓</a>
          </div>
        </section>

      </div>
    </>
  );
}