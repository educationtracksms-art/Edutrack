import { ReportCard } from "@/components/report/ReportCard";
import type { ReportCardData } from "@/lib/report-types";
import type { ReportModulePreferences } from "@/lib/report-module-preferences";

export function OLevelReportCard({
  data,
  modulePreferences,
}: {
  data: ReportCardData;
  modulePreferences?: ReportModulePreferences;
}) {
  return <ReportCard data={data} modulePreferences={modulePreferences} />;
}
