import { Link } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, Menu, Phone, Twitter, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import logoUrl from "@/assets/logo.png";

export function PublicShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-50 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logoUrl} alt="Education Track SMS logo" className="h-10 w-10 object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Education Track SMS</p>
              <p className="text-xs text-muted-foreground">Uganda School Management System | Edutrack | Eductrack</p>
            </div>
          </Link>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="public-navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {menuOpen ? (
            <button
              type="button"
              aria-label="Close navigation overlay"
              className="fixed inset-0 z-50 cursor-default bg-black/30 md:hidden"
              onClick={() => setMenuOpen(false)}
            />
          ) : null}

          <nav
            id="public-navigation"
            className={`absolute left-0 right-0 top-full z-[60] border-b border-border/70 bg-background px-4 py-4 shadow-lg md:static md:z-auto md:block md:border-0 md:bg-transparent md:p-0 md:shadow-none ${
              menuOpen ? "block" : "hidden"
            } md:block`}
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-1">
              <Link
                to="/"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-center font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:text-left"
              >
                Home
              </Link>
              <Link
                to="/website-pages/about"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-center font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:text-left"
              >
                About
              </Link>
              <Link
                to="/website-pages/features"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-center font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:text-left"
              >
                Features
              </Link>
              <Link
                to="/website-pages/blogs"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-center font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:text-left"
              >
                Blogs
              </Link>
              <Link
                to="/website-pages/contact-us"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-center font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:text-left"
              >
                Contact us
              </Link>
              <Link
                to="/signup"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-center font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:text-left"
              >
                Request access
              </Link>
              <Link
                to="/auth"
                preload="intent"
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-primary px-4 py-2 text-center font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign in
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main>{children}</main>

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
