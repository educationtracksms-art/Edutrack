import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { PublicShell } from "@/components/layout/PublicShell";
import { getFeature } from "../features";

const FIRST_FEATURE_SLUG = "students";

export const Route = createFileRoute("/website-pages/features/$slug")({
  head: ({ params }) => {
    const feature = getFeature(params.slug);
    return {
      meta: [
        { title: `${feature?.title ?? "Feature"} | Education Track SMS` },
        {
          name: "description",
          content:
            feature?.summary ??
            "Learn more about an Education Track SMS school module and how it supports school operations.",
        },
      ],
    };
  },
  component: FeatureDetailPage,
  loader: ({ params }) => {
    const feature = getFeature(params.slug);
    if (!feature) {
      throw redirect({
        to: "/website-pages/features/$slug",
        params: { slug: FIRST_FEATURE_SLUG },
      });
    }
    return feature;
  },
});

function FeatureDetailPage() {
  const feature = Route.useLoaderData();

  return (
    <PublicShell>
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-6">
          <Link to="/website-pages/features" className="text-sm font-medium text-accent hover:underline">
            Back to features
          </Link>
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Feature</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{feature.title}</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">{feature.summary}</p>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Read more</p>
          <div className="mt-4 grid gap-4">
            {feature.details.map((detail) => (
              <p key={detail} className="text-sm leading-7 text-muted-foreground">
                {detail}
              </p>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
