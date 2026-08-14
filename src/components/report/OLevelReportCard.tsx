import { ReportCard } from "@/components/report/ReportCard";
import type { ReportCardData } from "@/lib/report-types";

export function OLevelReportCard({ data }: { data: ReportCardData }) {
  return <ReportCard data={data} />;
}
