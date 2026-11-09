import { createFileRoute, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ALevelReportCard } from "@/components/report/ALevelReportCard";
import { OLevelReportCard } from "@/components/report/OLevelReportCard";
import { Btn, PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/reports/preview")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const canPrintReports = (roles ?? []).some((item) =>
      ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "super_admin"].includes(
        item.role,
      ),
    );
    if (!canPrintReports) throw redirect({ to: "/dashboard" });
  },
  component: PreviewPage,
});

function PreviewPage() {
  const navigate = useNavigate();
  const preview = useLocation({ select: (location) => location.state.reportPreview });

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Generated Reports"
          description={
            preview
              ? `${preview.cards.length} ${preview.reportLevel === "advanced" ? "A-Level" : "O-Level"} report card(s) ready to print.`
              : "Review generated report cards before printing or saving them as a PDF."
          }
          actions={
            <>
              <Btn variant="ghost" onClick={() => navigate({ to: "/reports" })}>
                Back to Reports
              </Btn>
              {preview?.cards.length ? (
                <Btn onClick={() => window.print()}>Print / Save PDF</Btn>
              ) : null}
            </>
          }
        />
      </div>

      {preview?.cards.length ? (
        <div className="report-preview-list space-y-6">
          {preview.cards.map((card) =>
            card.gradingLevel === "advanced" ? (
              <ALevelReportCard
                key={card.studentId}
                data={card}
                shrinkToFit={preview.shrinkToFit}
              />
            ) : (
              <OLevelReportCard
                key={card.studentId}
                data={card}
                shrinkToFit={preview.shrinkToFit}
              />
            ),
          )}
        </div>
      ) : (
        <p className="no-print p-6 text-sm text-muted-foreground">
          No generated reports were provided. Return to Reports and generate report cards first.
        </p>
      )}
    </div>
  );
}
