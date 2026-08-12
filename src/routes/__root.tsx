import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  useRouter,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const lastInvalidatedError = useRef<string | null>(null);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    const signature = `${error.name}:${error.message}`;
    if (lastInvalidatedError.current === signature) return;
    lastInvalidatedError.current = signature;
    router.invalidate();
  }, [error, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit an unexpected error while loading this page. Refreshing this route should not
          loop anymore.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => reset()}
          >
            Try again
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
            onClick={() => router.navigate({ to: "/auth", replace: true })}
          >
            Go to sign in
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Education Track SMS | Uganda School Management System" },
      {
        name: "description",
        content:
          "Education Track SMS is a Uganda-based school management system for admissions, student records, academics, assessments, reports and multi-school operations.",
      },
      { name: "author", content: "K-Dev Technologies Ltd" },
      {
        name: "keywords",
        content:
          "Uganda school management system, school ERP, education management system, student records, report cards, Education Track SMS",
      },
      { property: "og:title", content: "Education Track SMS | Uganda School Management System" },
      {
        property: "og:description",
        content:
          "Manage admissions, students, academics, assessments and reporting in one Uganda-focused school management platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
