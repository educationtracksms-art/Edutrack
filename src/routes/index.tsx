import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// Dynamic import keeps hero images off the critical initial JS bundle.
// The public shell (Shared by all non-authenticated pages) stays lean for /auth
// visitors who only need the logo and form.
const hero1 = (await import("@/assets/hero/hero-1.jpg")).default;
import { PublicShell } from "@/components/layout/PublicShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Education Track SMS | Uganda School Management System | Edutrack | Eductrack" },
      {
        name: "description",
        content:
          "Education Track SMS is a Uganda school management system for login, report cards, assessments, attendance, and school administration. Explore school software built for schools that want a free download style entry point, offline-ready workflows, and new curriculum support.",
      },
      { property: "og:title", content: "Education Track SMS | Uganda School Management System" },
      {
        property: "og:description",
        content:
          "Give your school a better way to manage learners, assessments, report cards, login access, and daily operations with one platform built for growth.",
      },
    ],
  }),
  component: Landing,
});

const HERO_IMAGES = [hero1];

function Landing() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [extraHeros, setExtraHeros] = useState<string[]>([]);
  const loadedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Keep this idle: the hero above is already painted. The remaining two
    // images load async so the landing bundle stays small for /auth visitors.
    const load = async () => {
      const [m2, m3] = await Promise.all([
        import("@/assets/hero/hero-2.jpg"),
        import("@/assets/hero/hero-3.jpg"),
      ]);
      if (!cancelled) setExtraHeros([m2.default, m3.default]);
    };

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => void load(), { timeout: 2000 });
      return () => {
        cancelled = true;
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(
          id,
        );
      };
    }

    // Fallback: load after a short delay so the critical render is never blocked.
    const id = window.setTimeout(() => void load(), 400);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [loadedOnce.current]);

  loadedOnce.current = true;

  const images = extraHeros.length ? [hero1, ...extraHeros] : HERO_IMAGES;

  useEffect(() => {
    if (images.length < 2) return;
    const interval = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % images.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [images.length]);

  return (
    <PublicShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {images.map((image, index) => (
            <div
              key={image}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
                index === heroIndex ? "opacity-100" : "opacity-0"
              }`}
              style={{ backgroundImage: `url(${image})` }}
            />
          ))}
          <div className="absolute inset-0 bg-slate-950/70" />
        </div>

        <div className="relative mx-auto flex min-h-[82vh] max-w-6xl flex-col justify-center px-6 py-20 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
            Education Track SMS
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Give your school a smarter way to work, grow, and serve learners better.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg">
            Education Track SMS helps schools reduce administrative stress, improve visibility, and
            focus more on teaching, learning, parent engagement, and school management system
            workflows used across Uganda.
          </p>
          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-white/20 bg-slate-950/40 px-5 py-4 text-sm leading-7 text-white/90 backdrop-blur">
            Looking for a school management system Uganda login, free download information, free
            offline school management system details, new curriculum sample report card PDF, term 2
            report card wording, or report cards in Uganda? Explore our public pages for
            school-ready guidance and reporting workflows.
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Join your school
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              Staff sign in
            </Link>
            <Link
              to="/website-pages/report-card-samples"
              className="rounded-md border border-white/25 bg-transparent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Sample report card
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
