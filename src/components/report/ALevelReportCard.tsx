import { ReportCard } from "@/components/report/ReportCard";
import type { ReportCardData } from "@/lib/report-types";
import type { ReportModulePreferences } from "@/lib/report-module-preferences";

export function ALevelReportCard({
  data,
  shrinkToFit,
  modulePreferences,
}: {
  data: ReportCardData;
  shrinkToFit?: boolean;
  modulePreferences?: ReportModulePreferences;
}) {
  return <ReportCard data={data} shrinkToFit={shrinkToFit} modulePreferences={modulePreferences} />;
}
