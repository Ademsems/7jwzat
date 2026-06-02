"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/reset-password`,
    });
    // Always show success — never reveal whether the email exists
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-slate-900">7jwzat</Link>
          <p className="text-gray-500 mt-1">Reset your password</p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-2xl">&#10003;</div>
            <h2 className="font-semibold text-gray-800">Check your email</h2>
            <p className="text-sm text-gray-500">
              If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
            </p>
            <Link href="/auth/login" className="block text-sm text-emerald-600 hover:underline mt-4">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-gray-500">
              Enter your email and we will send you a link to reset your password.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <p className="text-center text-sm text-gray-500">
              <Link href="/auth/login" className="text-emerald-600 hover:underline">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}