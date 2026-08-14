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

const SEO_CONFIG = {
  siteName: "Education Track SMS",
  siteUrl: "https://educationtrack.ug",
  defaultTitle: "Education Track SMS | Uganda School Management System | Edutrack | Eductrack",
  defaultDescription:
    "Education Track SMS helps Ugandan schools manage learners, assessments, report cards, attendance, finance, and daily administration in one platform.",
  author: "K-Dev Technologies Ltd",
  authorUrl: "https://kdevtechnologies.com",
  twitterHandle: "@EductrackUG",
  twitterCreator: "@KDevTechnologies",
  locale: "en_UG",
  region: "UG",
  themeColor: "#2563eb",
};

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
          We hit an unexpected error while loading this page. Refreshing this route should not loop
          anymore.
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
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
      { title: SEO_CONFIG.defaultTitle },
      { name: "description", content: SEO_CONFIG.defaultDescription },
      { name: "author", content: SEO_CONFIG.author },
      { name: "publisher", content: SEO_CONFIG.author },
      {
        name: "keywords",
        content:
          "education track sms, edutrack, school management system uganda, school management system uganda login, school management system uganda free download, school management system uganda download, free school management system uganda, free offline school management system, school ERP uganda, report cards, attendance, assessments, finance, student records",
      },
      { property: "og:title", content: SEO_CONFIG.defaultTitle },
      { property: "og:description", content: SEO_CONFIG.defaultDescription },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SEO_CONFIG.siteName },
      { property: "og:url", content: SEO_CONFIG.siteUrl },
      { property: "og:image", content: `${SEO_CONFIG.siteUrl}/og-image.jpg` },
      { property: "og:image:alt", content: `${SEO_CONFIG.siteName} social preview` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: SEO_CONFIG.locale },
      { property: "og:country-name", content: "Uganda" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SEO_CONFIG.defaultTitle },
      { name: "twitter:description", content: SEO_CONFIG.defaultDescription },
      { name: "twitter:site", content: SEO_CONFIG.twitterHandle },
      { name: "twitter:creator", content: SEO_CONFIG.twitterCreator },
      { name: "twitter:image", content: `${SEO_CONFIG.siteUrl}/twitter-card.jpg` },
      { name: "twitter:image:alt", content: `${SEO_CONFIG.siteName} social preview` },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { name: "bingbot", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { name: "theme-color", content: SEO_CONFIG.themeColor },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: SEO_CONFIG.siteName },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "format-detection", content: "telephone=no" },
      { name: "geo.region", content: SEO_CONFIG.region },
      { name: "geo.placename", content: "Kampala" },
      { name: "geo.position", content: "0.3476;32.5825" },
      { name: "ICBM", content: "0.3476, 32.5825" },
      { name: "application-name", content: SEO_CONFIG.siteName },
      { name: "generator", content: SEO_CONFIG.siteName },
      { name: "language", content: "English" },
      { httpEquiv: "content-language", content: "en-UG" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { rel: "canonical", href: SEO_CONFIG.siteUrl },
      { rel: "alternate", href: SEO_CONFIG.siteUrl, hrefLang: "en" },
      { rel: "alternate", href: SEO_CONFIG.siteUrl, hrefLang: "en-UG" },
      { rel: "alternate", href: SEO_CONFIG.siteUrl, hrefLang: "x-default" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "author", href: SEO_CONFIG.authorUrl },
      { rel: "publisher", href: SEO_CONFIG.authorUrl },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://www.google-analytics.com" },
      { rel: "preconnect", href: "https://api.educationtrack.ug" },
      { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
      { rel: "dns-prefetch", href: "https://api.educationtrack.ug" },
      { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
      { rel: "preload", href: "/favicon.png", as: "image" },
      { rel: "preload", href: "/logo.png", as: "image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SEO_CONFIG.siteName,
          alternateName: "EduTrack",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          description: SEO_CONFIG.defaultDescription,
          author: {
            "@type": "Organization",
            name: SEO_CONFIG.author,
            url: SEO_CONFIG.authorUrl,
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          featureList: [
            "Report cards",
            "Assessments",
            "Attendance tracking",
            "Finance management",
            "Student records",
            "Academic reporting",
            "School administration",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SEO_CONFIG.siteName,
          alternateName: "EduTrack",
          url: SEO_CONFIG.siteUrl,
          logo: `${SEO_CONFIG.siteUrl}/logo.png`,
          description: SEO_CONFIG.defaultDescription,
          address: {
            "@type": "PostalAddress",
            addressCountry: "UG",
            addressLocality: "Kampala",
          },
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "sales",
            availableLanguage: ["English"],
          },
          sameAs: [
            "https://twitter.com/EductrackUG",
            "https://linkedin.com/company/education-track-sms",
            "https://facebook.com/educationtrackug",
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you requested does not exist or may have moved.
        </p>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-UG">
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
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
