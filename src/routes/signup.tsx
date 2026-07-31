import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Mail } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { PublicShell } from "@/components/layout/PublicShell";
import logoUrl from "@/assets/logo.png";

const SERVICE_ID = "service_w7qelyg";
const TEMPLATE_ID = "template_1vqrwg4";
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? "";
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? TEMPLATE_ID;

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Request Access | Education Track SMS" },
      {
        name: "description",
        content:
          "Request access to Education Track SMS for your school. Send a signup request and our team will respond by email.",
      },
      { property: "og:title", content: "Request Access | Education Track SMS" },
      {
        property: "og:description",
        content: "Submit a school signup request and receive a response from the Education Track SMS team.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    schoolName: "",
    phone: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(form.fullName.trim() && form.email.trim() && form.schoolName.trim() && !loading),
    [form.email, form.fullName, form.schoolName, loading],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!PUBLIC_KEY) {
        throw new Error("Missing VITE_EMAILJS_PUBLIC_KEY environment variable.");
      }

      const payload = {
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: {
          to_name: "Education Track SMS Team",
          to_email: "kevinatwijukat@gmail.com",
          from_name: form.fullName,
          from_email: form.email,
          school_name: form.schoolName,
          phone_number: form.phone,
          message:
            form.message ||
            "Requesting access to Education Track SMS. Please send onboarding details and next steps.",
          reply_to: form.email,
          subject: `New signup request from ${form.schoolName}`,
        },
      };

      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to send the signup request.");
      }

      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send the signup request.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <PublicShell>
        <div className="px-6 py-10">
          <div className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-sm">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <h1 className="mt-5 text-3xl font-bold tracking-tight">Your request has been sent</h1>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">
              A signup request has been sent successfully. A response will be provided by email shortly.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                to="/"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Back home
              </Link>
              <Link
                to="/auth"
                className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="px-6 py-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="rounded-3xl border border-border bg-card p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Education Track SMS logo" className="h-12 w-12 object-cover" />
              <div>
                <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Education Track SMS
                </p>
                <h1 className="text-2xl font-bold tracking-tight">Request access for your school</h1>
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              Send a request to the team and we will respond by email. This page does not connect to the
              database; it sends the request directly through EmailJS.
            </p>

            <form onSubmit={submit} className="mt-8 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} required />
                <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="School name" value={form.schoolName} onChange={(value) => setForm({ ...form, schoolName: value })} required />
                <Field label="Phone number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="message">
                  Message
                </label>
                <textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Tell us a little about your school and the access you need."
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail className="h-4 w-4" />
                {loading ? "Sending request..." : "Send signup request"}
              </button>
            </form>
          </section>

          <aside className="rounded-3xl border border-border bg-muted/30 p-8 shadow-sm">
            <div className="rounded-2xl bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">Request access</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Fill in the form and we will respond by email after reviewing your request.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={label.toLowerCase().replace(/\s+/g, "-")}>
        {label}
      </label>
      <input
        id={label.toLowerCase().replace(/\s+/g, "-")}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
