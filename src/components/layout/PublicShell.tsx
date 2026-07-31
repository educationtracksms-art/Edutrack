import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";

import logoUrl from "@/assets/logo.png";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Education Track SMS logo" className="h-10 w-10 object-cover" />
            <div>
              <p className="text-sm font-semibold leading-tight">Education Track SMS</p>
              <p className="text-xs text-muted-foreground">Uganda School Management System</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Home
            </Link>
            <Link
              to="/signup"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Request access
            </Link>
            <Link
              to="/auth"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border/70 bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-sm font-semibold text-foreground">Developed by K-Dev Technologies Ltd</p>
            <p className="mt-1 text-sm text-muted-foreground">Kevin Atwijuka</p>
            <p className="mt-2 text-sm text-muted-foreground">
              © {new Date().getFullYear()} Education Track SMS. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <a
              href="mailto:kevinatwijukat@gmail.com"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Mail className="h-4 w-4" />
              kevinatwijukat@gmail.com
            </a>
            <a
              href="tel:+256760228289"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Phone className="h-4 w-4" />
              +256760228289
            </a>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Request access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
