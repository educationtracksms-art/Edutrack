import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/layout/PublicShell";

export const Route = createFileRoute("/website-pages/blogs")({
  head: () => ({
    meta: [
      { title: "Blogs | Education Track SMS" },
      {
        name: "description",
        content:
          "Read updates, school technology notes, and product stories from the Education Track SMS team.",
      },
      { property: "og:title", content: "Blogs | Education Track SMS" },
      {
        property: "og:description",
        content:
          "Stay informed with articles about school operations, education technology, and product updates.",
      },
    ],
  }),
  component: BlogsPage,
});

function BlogsPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Blogs</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">
          Ideas and updates for better school systems.
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          This section can grow into your article hub for product updates, school workflow tips, and
          education technology insights.
        </p>
      </section>
    </PublicShell>
  );
}
