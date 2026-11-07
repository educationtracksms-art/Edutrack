import { ReportCard } from "@/components/report/ReportCard";
import type { ReportCardData } from "@/lib/report-types";

export function ALevelReportCard({
  data,
  shrinkToFit,
}: {
  data: ReportCardData;
  shrinkToFit?: boolean;
}) {
  return <ReportCard data={data} shrinkToFit={shrinkToFit} />;
}
