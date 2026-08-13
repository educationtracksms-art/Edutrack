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

// SEO Configuration with Brand Variations
const SEO_CONFIG = {
  siteName: "Education Track SMS",
  siteNameShort: "Eductrack | Eductrack",
  siteNameFull: "Education Track SMS (Eductrack | Eductrack)",
  siteUrl: "https://educationtrack.ug",
  defaultTitle: "Education Track SMS (Eductrack | Eductrack) | Uganda's #1 School Management System & ERP",
  defaultDescription: "Education Track SMS (Eductrack | Eductrack) is Uganda's leading school management system for admissions, academic management, new curriculum reporting, assessments, finance, attendance, multi-school operations, and complete school administration.",
  author: "K-Dev Technologies Ltd",
  authorUrl: "https://kdevtechnologies.com",
  twitterHandle: "@Eductrack | EductrackUG",
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
      // Character Set & Viewport
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
      
      // Primary Title with Brand Variations
      { title: "Education Track SMS (Eductrack | Eductrack) | Uganda's #1 School Management System & ERP" },
      
      // Primary Description - Heavy focus on curriculum and reporting
      { 
        name: "description", 
        content: "Education Track SMS (Eductrack | Eductrack) - Uganda's #1 school management system for new curriculum reporting, O-Level reports, A-Level reports, UCE report cards, UACE transcripts, competency-based assessment, learner performance tracking, and complete school administration in Uganda." 
      },
      
      // Author & Brand
      { name: "author", content: SEO_CONFIG.author },
      { name: "publisher", content: SEO_CONFIG.author },
      { name: "copyright", content: `© ${new Date().getFullYear()} ${SEO_CONFIG.author}` },
      
      // Comprehensive Keywords - Heavy emphasis on curriculum and reporting
      { 
        name: "keywords", 
        content: [
          // ===== UGANDA NEW CURRICULUM & REPORTING (PRIMARY FOCUS) =====
          "Uganda new curriculum reporting",
          "new curriculum reporting Uganda",
          "Uganda new curriculum report",
          "Uganda new curriculum assessment",
          "competency-based assessment Uganda",
          "competence based curriculum Uganda",
          "Uganda new curriculum reporting tool",
          "Uganda new curriculum report card",
          "new curriculum report cards Uganda",
          "Uganda new curriculum grading system",
          "Uganda new curriculum results",
          "Uganda new curriculum transcripts",
          "Uganda lower secondary new curriculum",
          "Uganda upper secondary new curriculum",
          "Uganda competency based curriculum reporting",
          "Uganda new curriculum performance reports",
          "Uganda new curriculum assessment reports",
          "new curriculum continuous assessment Uganda",
          
          // ===== O-LEVEL REPORTS (PRIMARY FOCUS) =====
          "O-Level reports Uganda",
          "Uganda O-Level report",
          "Uganda O-Level report card",
          "O-Level results Uganda",
          "O-Level transcript Uganda",
          "O-Level performance report Uganda",
          "UCE report card Uganda",
          "UCE results Uganda",
          "Uganda Certificate of Education report",
          "O-Level academic report Uganda",
          "O-Level student report Uganda",
          "O-Level examination results Uganda",
          "O-Level grading system Uganda",
          "O-Level subject report Uganda",
          "O-Level term report Uganda",
          "O-Level annual report Uganda",
          "Uganda O-Level transcript generator",
          "O-Level report card generator Uganda",
          
          // ===== A-LEVEL REPORTS (PRIMARY FOCUS) =====
          "A-Level reports Uganda",
          "Uganda A-Level report",
          "Uganda A-Level report card",
          "A-Level results Uganda",
          "A-Level transcript Uganda",
          "A-Level performance report Uganda",
          "UACE report card Uganda",
          "UACE results Uganda",
          "Uganda Advanced Certificate of Education report",
          "A-Level academic report Uganda",
          "A-Level student report Uganda",
          "A-Level examination results Uganda",
          "A-Level grading system Uganda",
          "A-Level subject report Uganda",
          "A-Level term report Uganda",
          "A-Level annual report Uganda",
          "Uganda A-Level transcript generator",
          "A-Level report card generator Uganda",
          "A-Level subject combination report Uganda",
          
          // ===== COMMON MISSPELLINGS & VARIATIONS =====
          "Uganda new curiculum report",
          "Uganda new curriculam report",
          "Uganda new curricullum report",
          "Uganda 0-Level report",
          "Uganda O level report",
          "Uganda Olevel report",
          "Uganda A level report",
          "Uganda Alevel report",
          "Uganda 0 level report card",
          "Uganda new curriculum repot",
          "Uganda new curiculum reporting",
          "Uganda new curriculam reporting",
          "Uganda new curricullum reporting",
          
          // ===== UGANDA REPORT CARDS =====
          "Uganda report card",
          "Uganda school report card",
          "Uganda student report card",
          "Uganda academic report card",
          "Uganda term report card",
          "Uganda annual report card",
          "Uganda school reports",
          "Uganda student reports",
          "Uganda academic reports",
          "Uganda school report generator",
          "Uganda report card maker",
          "Uganda school report system",
          "Uganda digital report cards",
          "Uganda online report cards",
          
          // ===== SCHOOL MANAGEMENT SYSTEM WITH REPORTING =====
          "school management system for reporting Uganda",
          "school report management system Uganda",
          "Uganda school reporting software",
          "academic reporting system Uganda",
          "school report automation Uganda",
          "Uganda school results management",
          "school performance reporting Uganda",
          "student performance reporting Uganda",
          "academic results management Uganda",
          "school transcript management Uganda",
          "Uganda school reporting dashboard",
          "school data reporting Uganda",
          
          // ===== CURRICULUM ASSESSMENT =====
          "Uganda curriculum assessment",
          "Uganda competency assessment",
          "Uganda continuous assessment",
          "Uganda learner assessment",
          "Uganda student assessment system",
          "Uganda formative assessment",
          "Uganda summative assessment",
          "Uganda assessment management",
          "Uganda examination results",
          "Uganda test results management",
          "Uganda marks entry system",
          "Uganda grading system",
          
          // ===== TEACHER & LEARNER REPORTS =====
          "teacher report comments Uganda",
          "learner progress report Uganda",
          "student progress report Uganda",
          "class performance report Uganda",
          "subject performance report Uganda",
          "termly report Uganda",
          "end of term report Uganda",
          "end of year report Uganda",
          "Uganda teacher report card",
          "Uganda student progress tracking",
          
          // ===== PRINTABLE & DIGITAL REPORTS =====
          "printable report cards Uganda",
          "digital report cards Uganda",
          "PDF report cards Uganda",
          "report card template Uganda",
          "report card format Uganda",
          "Uganda school report template",
          "Uganda transcript template",
          
          // ===== EDUCATION TRACK BRAND + REPORTING =====
          "Eductrack | Eductrack Uganda",
          "Education Track SMS reports",
          "Eductrack | Eductrack report cards",
          "Eductrack | Eductrack new curriculum",
          "Eductrack | Eductrack O-Level reports",
          "Eductrack | Eductrack A-Level reports",
          "Education Track Uganda curriculum",
          
          // ===== ADDITIONAL SEARCH TERMS =====
          "Uganda secondary school reports",
          "Uganda primary school reports",
          "Uganda school results portal",
          "Uganda academic records",
          "Uganda student database",
          "Uganda school ERP",
          "school management software Uganda",
          "education management system Uganda",
          "best school software Uganda",
          "Uganda edtech",
          "school administration Uganda"
        ].join(", ")
      },
      
      // Open Graph Tags - Focus on curriculum and reporting
      { property: "og:title", content: "Education Track SMS (Eductrack | Eductrack) | Uganda New Curriculum & O-Level/A-Level Reporting System" },
      { 
        property: "og:description", 
        content: "Eductrack | Eductrack - Uganda's leading school management system for new curriculum reporting, O-Level reports, A-Level reports, UCE & UACE results, competency-based assessment, and complete academic reporting." 
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Education Track SMS (Eductrack | Eductrack)" },
      { property: "og:url", content: SEO_CONFIG.siteUrl },
      { property: "og:image", content: `${SEO_CONFIG.siteUrl}/og-image.jpg` },
      { property: "og:image:alt", content: "Education Track SMS (Eductrack | Eductrack) - Uganda New Curriculum & O-Level/A-Level Reports" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: SEO_CONFIG.locale },
      { property: "og:country-name", content: "Uganda" },
      { property: "og:email", content: "info@educationtrack.ug" },
      { property: "og:phone_number", content: "+256-XXX-XXX-XXX" },
      
      // Twitter Card - Focus on curriculum and reporting
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Education Track SMS (Eductrack | Eductrack) | Uganda New Curriculum & Reporting System" },
      { 
        name: "twitter:description", 
        content: "Eductrack | Eductrack - Uganda's leading system for new curriculum reporting, O-Level reports, A-Level reports, UCE/UACE results, and competency-based assessment." 
      },
      { name: "twitter:site", content: "@Eductrack | EductrackUG" },
      { name: "twitter:creator", content: "@KDevTechnologies" },
      { name: "twitter:image", content: `${SEO_CONFIG.siteUrl}/twitter-card.jpg` },
      { name: "twitter:image:alt", content: "Eductrack | Eductrack - Uganda New Curriculum & O-Level/A-Level Reports" },
      { name: "twitter:label1", content: "Features" },
      { name: "twitter:data1", content: "New Curriculum, O-Level, A-Level Reports" },
      { name: "twitter:label2", content: "Location" },
      { name: "twitter:data2", content: "Uganda" },
      
      // Advanced SEO & Mobile Tags
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { name: "bingbot", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { name: "theme-color", content: SEO_CONFIG.themeColor },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Eductrack | Eductrack" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "format-detection", content: "telephone=no" },
      { name: "geo.region", content: SEO_CONFIG.region },
      { name: "geo.placename", content: "Kampala" },
      { name: "geo.position", content: "0.3476;32.5825" },
      { name: "ICBM", content: "0.3476, 32.5825" },
      { name: "application-name", content: "Eductrack | Eductrack" },
      { name: "generator", content: "Education Track SMS" },
      
      // Language & Localization
      { name: "language", content: "English" },
      { httpEquiv: "content-language", content: "en-UG" },
      
      // Verification Tags
      { name: "google-site-verification", content: "YOUR_GOOGLE_VERIFICATION_CODE" },
      { name: "msvalidate.01", content: "YOUR_BING_VERIFICATION_CODE" },
      { name: "yandex-verification", content: "YOUR_YANDEX_VERIFICATION_CODE" },
    ],
    
    links: [
      // Stylesheet
      {
        rel: "stylesheet",
        href: appCss,
      },
      
      // Icons
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-57x57.png", sizes: "57x57", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-72x72.png", sizes: "72x72", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-76x76.png", sizes: "76x76", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-114x114.png", sizes: "114x114", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-120x120.png", sizes: "120x120", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-144x144.png", sizes: "144x144", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-152x152.png", sizes: "152x152", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-180x180.png", sizes: "180x180", type: "image/png" },
      
      // SEO Links
      { rel: "canonical", href: SEO_CONFIG.siteUrl },
      { rel: "alternate", href: SEO_CONFIG.siteUrl, hrefLang: "en" },
      { rel: "alternate", href: SEO_CONFIG.siteUrl, hrefLang: "en-UG" },
      { rel: "alternate", href: SEO_CONFIG.siteUrl, hrefLang: "x-default" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "sitemap", href: "/sitemap.xml", type: "application/xml" },
      { rel: "sitemap", href: "/sitemap.xml", type: "application/rss+xml" },
      { rel: "author", href: SEO_CONFIG.authorUrl },
      { rel: "publisher", href: SEO_CONFIG.authorUrl },
      
      // Performance Optimization
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://www.google-analytics.com" },
      { rel: "preconnect", href: "https://api.educationtrack.ug" },
      { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
      { rel: "dns-prefetch", href: "https://api.educationtrack.ug" },
      { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
      
      // Preload critical assets
      { rel: "preload", href: "/favicon.png", as: "image" },
      { rel: "preload", href: "/logo.png", as: "image" },
    ],
    
    // Structured Data with Strong Curriculum & Reporting Focus
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Education Track SMS (Eductrack | Eductrack)",
          "alternateName": "Eductrack | Eductrack",
          "applicationCategory": "EducationalApplication",
          "operatingSystem": "Web",
          "description": "Eductrack | Eductrack - Uganda's leading school management system specializing in new curriculum reporting, O-Level reports, A-Level reports, UCE & UACE results, competency-based assessment, and complete academic reporting for Uganda schools.",
          "author": {
            "@type": "Organization",
            "name": "K-Dev Technologies Ltd",
            "url": "https://kdevtechnologies.com"
          },
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "review": {
            "@type": "Review",
            "reviewRating": {
              "@type": "Rating",
              "ratingValue": "4.8",
              "bestRating": "5"
            },
            "author": {
              "@type": "Organization",
              "name": "Eductrack | Eductrack Users"
            }
          },
          "featureList": [
            "Uganda New Curriculum Reporting",
            "O-Level Reports (UCE)",
            "A-Level Reports (UACE)",
            "Competency-Based Assessment",
            "Continuous Assessment Tracking",
            "Report Card Generation",
            "Transcript Generation",
            "Student Performance Analytics",
            "Academic Results Management",
            "Teacher Comment Management",
            "Grading System Management",
            "Term and Annual Reports"
          ]
        })
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Education Track SMS (Eductrack | Eductrack)",
          "alternateName": "Eductrack | Eductrack",
          "url": "https://educationtrack.ug",
          "logo": "https://educationtrack.ug/logo.png",
          "description": "Eductrack | Eductrack - Uganda's leading school management system for new curriculum reporting, O-Level, and A-Level reports",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "UG",
            "addressLocality": "Kampala"
          },
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "sales",
            "availableLanguage": ["English"]
          },
          "sameAs": [
            "https://twitter.com/Eductrack | EductrackUG",
            "https://linkedin.com/company/education-track-sms",
            "https://facebook.com/Eductrack | Eductrackug"
          ]
        })
      }
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
