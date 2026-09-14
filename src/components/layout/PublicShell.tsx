import { Link } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
import { ArrowUpRight, Facebook, Instagram, Mail, Menu, Phone, Sparkles, Twitter, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import logoUrl from "@/assets/logo.png";
import pageHero from "@/assets/hero/hero-2.jpg";

export function PublicShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 shadow-[0_8px_30px_oklch(0.2_0.04_258_/_0.06)] backdrop-blur-xl">
        <div className="hidden bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:block">
          <span className="inline-flex items-center gap-2">
            Built for ambitious schools across Uganda
            <Link to="/website-pages/features" className="ml-1 underline underline-offset-4 hover:text-accent">
              Explore the platform <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" />
            </Link>
          </span>
        </div>
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary p-1 shadow-lg shadow-primary/20 transition-transform group-hover:-rotate-3">
              <img src={logoUrl} alt="Education Track SMS logo" className="h-full w-full rounded-xl object-cover" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight tracking-tight text-foreground sm:text-base">Education Track</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">School Management System</p>
            </div>
          </Link>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background p-2.5 text-foreground shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="public-navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <nav
            id="public-navigation"
            className={`absolute left-3 right-3 top-[calc(100%+0.75rem)] z-[60] rounded-2xl border border-border bg-background p-3 shadow-2xl shadow-primary/10 md:static md:block md:border-0 md:bg-transparent md:p-0 md:shadow-none ${menuOpen ? "block" : "hidden"} md:block`}
          >
            <div className="flex flex-col gap-1 text-sm md:flex-row md:flex-nowrap md:items-center md:gap-1">
              <Link
                to="/"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-center font-medium transition-colors sm:text-left ${location.pathname === "/" ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                Home
              </Link>
              <Link
                to="/website-pages/about"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-left"
              >
                About
              </Link>
              <Link
                to="/website-pages/features"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-left"
              >
                Features
              </Link>
              <Link
                to="/website-pages/report-card-samples"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-left"
              >
                Report card samples
              </Link>
              <Link
                to="/website-pages/blogs"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-left"
              >
                Blogs
              </Link>
              <Link
                to="/website-pages/contact-us"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-left"
              >
                Contact us
              </Link>
              <Link
                to="/signup"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="whitespace-nowrap rounded-xl px-3 py-2.5 text-center font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-left"
              >
                Sign up
              </Link>
              <Link
                to="/auth"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="mt-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 md:mt-0"
              >
                Sign in <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main>
        {location.pathname.startsWith("/website-pages") ? (
          <section
            className="relative isolate overflow-hidden bg-slate-950 text-white"
            style={{ backgroundImage: `url(${pageHero})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 -z-10 bg-slate-950/65" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-primary/35" />
            <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 md:py-20 lg:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Education Track SMS</p>
              <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Better tools for better-run schools.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
                Explore the ideas, features, and resources that help schools across Uganda work with
                more clarity and confidence.
              </p>
            </div>
          </section>
        ) : null}
        {children}
      </main>

      <footer className="border-t border-white/10 bg-slate-950 text-slate-100">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_0.9fr_0.8fr]">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Education Track SMS logo"
                className="h-10 w-10 object-cover"
              />
              <div>
                <p className="text-sm font-semibold">Education Track SMS</p>
                <p className="text-xs text-slate-400">Uganda School Management System | Edutrack | Eductrack</p>
              </div>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              A modern school platform for admissions, assessments, reporting, and day-to-day
              administration.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="mailto:kevinatwijukat@gmail.com"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/10"
              >
                <Mail className="h-4 w-4" />
                Email us
              </a>
              <a
                href="tel:+256760228289"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/10"
              >
                <Phone className="h-4 w-4" />
                Call us
              </a>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Pages</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <Link to="/website-pages/about" className="transition-colors hover:text-white">
                About
              </Link>
              <Link to="/website-pages/features" className="transition-colors hover:text-white">
                Features
              </Link>
              <Link
                to="/website-pages/report-card-samples"
                className="transition-colors hover:text-white"
              >
                Report card samples
              </Link>
              <Link to="/website-pages/blogs" className="transition-colors hover:text-white">
                Blogs
              </Link>
              <Link to="/website-pages/contact-us" className="transition-colors hover:text-white">
                Contact us
              </Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">
              Stay connected
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 p-3 text-slate-100 transition-colors hover:bg-white/10"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 p-3 text-slate-100 transition-colors hover:bg-white/10"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://www.x.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 p-3 text-slate-100 transition-colors hover:bg-white/10"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-400">
              © {new Date().getFullYear()} Education Track SMS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
