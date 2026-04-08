"use client";

export default function AdminReviewPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold text-white">Admin Review</h1>
      <p className="mt-3 text-white/70">
        This page is temporarily disabled until secure admin authentication is added.
      </p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
        For security, pending-submission review is unavailable from the public site right now.
      </div>
    </div>
  );
}