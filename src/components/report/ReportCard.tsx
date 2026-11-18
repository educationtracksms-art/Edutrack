import type { ReportCardData } from "@/lib/report-types";
import {
  DEFAULT_REPORT_MODULE_PREFERENCES,
  type ReportModulePreferences,
} from "@/lib/report-module-preferences";
import { useEffect, useRef, type CSSProperties } from "react";

export function ReportCard({
  data,
  modulePreferences = DEFAULT_REPORT_MODULE_PREFERENCES,
}: {
  data: ReportCardData;
  modulePreferences?: ReportModulePreferences;
}) {
  const {
    school,
    student,
    gradingLevel,
    attendance,
    rows,
    overall,
    approval,
    gradeKeys,
    coCurricular,
    comments,
    staff,
    totalPoints,
    activeSummativePeriods,
  } = data;
  const isAdvanced = gradingLevel === "advanced";
  const includeGrades = modulePreferences.grades;
  // Older saved previews may not carry this preference yet; keep marks enabled by default.
  const includeAssessmentMarks = modulePreferences.assessmentMarks ?? true;
  const showAssessmentResults = includeGrades || includeAssessmentMarks;
  const resultColumnCount =
    1 +
    (isAdvanced ? 1 : 0) +
    (includeAssessmentMarks ? (isAdvanced ? 0 : 1) + activeSummativePeriods.length + 1 : 0) +
    (includeGrades ? (isAdvanced ? 4 : 3) : 0);
  const watermarkLabel = school.name || "School";
  const reportRef = useRef<HTMLDivElement | null>(null);
  const paymentLabel =
    modulePreferences.paymentReferenceType === "account_number" ? "Account No." : "SchPay Code";
  const paymentValue =
    modulePreferences.paymentReferenceType === "account_number"
      ? modulePreferences.accountNumber || school.reportAccountNumber || ""
      : student.schpayCode || "";
  const nextTermBeginsOn = (() => {
    const value = school.reportNextTermBeginsOn?.trim();
    if (!value) return "";

    const parts = value.split("-");
    if (parts.length !== 3) return value;

    const [year, month, day] = parts;
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthIndex = Number(month) - 1;
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex >= monthNames.length) {
      return value;
    }

    return `${day.padStart(2, "0")} ${monthNames[monthIndex]} ${year}`;
  })();

  useEffect(() => {
    const node = reportRef.current;
    if (!node) return;

    const onBeforePrint = () => {
      const sheet = node.querySelector<HTMLElement>(".report-sheet");
      if (!sheet) return;

      const pixelsPerMillimeter = 96 / 25.4;
      const printableWidth = 198 * pixelsPerMillimeter;
      const printableHeight = 285 * pixelsPerMillimeter;
      const contentWidth = Math.max(sheet.scrollWidth, sheet.getBoundingClientRect().width);
      const contentHeight = Math.max(sheet.scrollHeight, sheet.getBoundingClientRect().height);
      const scale = Math.min(
        1,
        printableWidth / Math.max(contentWidth, 1),
        printableHeight / Math.max(contentHeight, 1),
      );

      sheet.style.setProperty("--print-scale", String(scale));
    };

    const onAfterPrint = () => {
      const sheet = node.querySelector<HTMLElement>(".report-sheet");
      sheet?.style.setProperty("--print-scale", "1");
    };

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  return (
    <div
      ref={reportRef}
      className={`report-doc ${isAdvanced ? "advanced-report" : ""}`}
      style={{ "--print-scale": 1 } as CSSProperties}
    >
      <div className="report-sheet">
        <div className="report-watermark" aria-hidden="true">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt="" />
          ) : (
            <span>{school.initials || watermarkLabel.slice(0, 3).toUpperCase()}</span>
          )}
        </div>
        <header>
          <div className="header-top">
            <div className="logo">
              {school.logoUrl ? (
                <img src={school.logoUrl} alt={`${school.name} logo`} />
              ) : (
                <span>{school.initials}</span>
              )}
            </div>
            <div className="school-details">
              <h1>{school.name}</h1>
              {school.motto && <p className="motto">{school.motto}</p>}
              <p>
                {school.address}
                {school.email ? ` | Email: ${school.email}` : ""}
                {school.phone ? ` | Tel: ${school.phone}` : ""}
              </p>
            </div>
          </div>
          <div className="blue-line" />
          <div className="red-line" />
          <h2>{data.title}</h2>
        </header>

        <table className="student-info-table">
          <colgroup>
            <col className="student-info-lin-label-col" />
            <col className="student-info-lin-value-col" />
            <col className="student-info-field-label-col" />
            <col className="student-info-field-value-col" />
            <col className="student-info-attendance-col" />
            <col className="student-info-photo-col" />
          </colgroup>
          <tbody>
            <tr>
              <td className="label-lin">LIN:</td>
              <td className="value-lin">{student.lin}</td>
              <td className="label-name">Name:</td>
              <td className="value-name">{student.name}</td>
              <td className="attendance-cell" rowSpan={3}>
                {modulePreferences.attendance && attendance && (
                  <table>
                    <tbody>
                      <tr>
                        <th colSpan={2}>ATTENDANCE</th>
                      </tr>
                      <tr>
                        <td>Days Present</td>
                        <td>{attendance.present}</td>
                      </tr>
                      <tr>
                        <td>Days Absent</td>
                        <td>{attendance.absent}</td>
                      </tr>
                      <tr>
                        <td>Total</td>
                        <td>{attendance.total}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </td>
              <td className="passport-cell" rowSpan={3}>
                {student.photoUrl ? (
                  <img className="passport" src={student.photoUrl} alt={student.name} />
                ) : (
                  <div className="passport">
                    PASSPORT
                    <br />
                    PHOTO
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td className="label-small">{paymentLabel}:</td>
              <td className="value-small">{paymentValue}</td>
              {modulePreferences.includeFeesBalance && student.feesBalance !== null ? (
                <>
                  <td className="label-small">Fees Bal:</td>
                  <td className="value-small">{student.feesBalance}</td>
                </>
              ) : (
                <td className="empty-info-cell" colSpan={2} />
              )}
            </tr>
            <tr>
              <td className="label-small">House:</td>
              <td className="value-small">{student.house}</td>
              <td className="label-small">Class / Stream:</td>
              <td className="value-small">{student.classStream}</td>
            </tr>
          </tbody>
        </table>

        {showAssessmentResults && (
          <>
        <h2 className="title">
          {includeAssessmentMarks && !includeGrades
            ? "APPROVED ASSESSMENT MARKS"
            : "ASSESSMENT RESULTS SUMMARY"}
        </h2>
        <table className="results">
          <colgroup>
            <col className="results-subject-col" />
            {isAdvanced && <col className="results-paper-col" />}
            {!isAdvanced && includeAssessmentMarks && <col className="results-formative-col" />}
            {includeAssessmentMarks && activeSummativePeriods.map((period) => (
              <col className="results-summative-col" key={period} />
            ))}
            {includeGrades && <col className="results-total-col" />}
            {includeGrades && isAdvanced && <col className="results-average-col" />}
            {includeGrades && <col className="results-grade-col" />}
            {includeGrades && <col className="results-descriptor-col" />}
            {includeAssessmentMarks && <col className="results-teacher-col" />}
          </colgroup>
          <thead>
            {isAdvanced ? (
              <tr>
                <th colSpan={2}>SUBJECT</th>
                {includeAssessmentMarks && activeSummativePeriods.map((period) => <th key={period}>{period} / 100</th>)}
                {includeGrades && <>
                  <th>Total</th>
                  <th>TOTAL A/V</th>
                  <th>Grade</th>
                  <th>Points</th>
                </>}
                {includeAssessmentMarks && <th>Teacher</th>}
              </tr>
            ) : (
              <>
                <tr>
                  <th>SUBJECT</th>
                  {includeAssessmentMarks && <>
                    <th>
                      Formative
                      <br />
                      (20%)
                    </th>
                    {activeSummativePeriods.length > 0 && (
                      <th colSpan={activeSummativePeriods.length}>Summative (80%)</th>
                    )}
                  </>}
                  {includeGrades && <>
                    <th>Total</th>
                    <th>Grade</th>
                    <th>Grade Descriptor</th>
                  </>}
                  {includeAssessmentMarks && <th>Teacher</th>}
                </tr>
                <tr>
                  <th />
                  {includeAssessmentMarks && <>
                    <th />
                    {activeSummativePeriods.map((period) => <th key={period}>{period}</th>)}
                  </>}
                  {includeGrades && <>
                    <th />
                    <th />
                    <th />
                  </>}
                  {includeAssessmentMarks && <th />}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={resultColumnCount} className="text-center">
                  No assessment marks are available for this term.
                </td>
              </tr>
            ) : isAdvanced
              ? Array.from(
                  rows.reduce((groups, row) => {
                    if (row.isSubjectSummary) return groups;
                    const key = row.subjectId ?? row.subject;
                    const group = groups.get(key) ?? { papers: [], summary: undefined };
                    group.papers.push(row);
                    groups.set(key, group);
                    return groups;
                  }, new Map<string, { papers: typeof rows; summary?: (typeof rows)[number] }>()),
                ).map(([key, group]) => {
                  const summary = rows.find(
                    (row) => row.isSubjectSummary && (row.subjectId ?? row.subject) === key,
                  );
                  return group.papers.map((row, index) => (
                    <tr key={`${row.subject}-${row.paperId ?? index}`}>
                      {index === 0 && <td rowSpan={group.papers.length}>{row.subject}</td>}
                      <td>{row.paperName}</td>
                      {includeAssessmentMarks && activeSummativePeriods.map((period) => (
                        <td key={period}>
                          {period === "BOT" ? row.bot : period === "MOT" ? row.mot : row.eot}
                        </td>
                      ))}
                      {includeGrades && <td>{row.total}</td>}
                      {includeGrades && index === 0 && (
                        <>
                          <td rowSpan={group.papers.length}>{summary?.totalAverage ?? ""}</td>
                          <td rowSpan={group.papers.length}>{summary?.grade ?? ""}</td>
                          <td rowSpan={group.papers.length}>{summary?.subjectPoints ?? ""}</td>
                        </>
                      )}
                      {includeAssessmentMarks && <td>{row.teacher}</td>}
                    </tr>
                  ));
                })
              : rows.map((row) => (
                  <tr key={`${row.subject}-${row.paperId ?? "summary"}`}>
                    <td>{row.subject}</td>
                    {includeAssessmentMarks && <td>{row.formative}</td>}
                    {includeAssessmentMarks && activeSummativePeriods.map((period) => (
                      <td key={period}>
                        {period === "BOT" ? row.bot : period === "MOT" ? row.mot : row.eot}
                      </td>
                    ))}
                    {includeGrades && <>
                      <td>{row.total}</td>
                      <td>{row.grade}</td>
                      <td>{row.gradeDetail}</td>
                    </>}
                    {includeAssessmentMarks && <td>{row.teacher}</td>}
                  </tr>
                ))}
          </tbody>
        </table>

        {includeGrades && !isAdvanced && (
          <table className="overall-table">
            <tbody>
              <tr>
                <td>
                  <div className="overall-cell">
                    <span>
                      <strong>OVERALL AVERAGE ACHIEVEMENT</strong>{" "}
                      <span className="avg-score">{overall.average}</span>
                    </span>
                    <span className="identifier-block">
                      <strong>{overall.metricLabel}:</strong> {overall.metric}
                    </span>
                    {overall.descriptor && (
                      <span className="descriptor-block">
                        <strong>Descriptor:</strong> {overall.descriptor}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {includeGrades && <section className="definitions">
          <div className="keywords">
            {isAdvanced && (
              <div className="overall-cell" style={{ marginBottom: "8px" }}>
                <span>
                  <strong>TOTAL POINTS:</strong> <span className="avg-score">{totalPoints ?? 0}</span>
                </span>
              </div>
            )}
            <h3>{isAdvanced ? "A-LEVEL GRADE KEY" : "KEY WORDS AND DEFINITION OF TERMS"}</h3>
            <table>
              <tbody>
                <tr>
                  <th>{isAdvanced ? "Grade" : "Identifier"}</th>
                  <th>Score Range</th>
                  <th>{isAdvanced ? "Points" : "Descriptor"}</th>
                </tr>
                {gradeKeys.map((key) => (
                  <tr key={key.identifier}>
                    <td>{key.identifier}</td>
                    <td>{key.range}</td>
                    <td>{key.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isAdvanced && (
            <div className="meaning">
              <p>
                <strong>Competency:</strong> The overall expected capability of a learner after
                exposure to knowledge, skills and values.
              </p>
              <p>
                <strong>Descriptor:</strong> Gives details on the extent to which the learner has
                achieved the stipulated learning outcomes.
              </p>
              <p>
                <strong>Generic Skills:</strong> Higher order transferable skills applied in school
                and work.
              </p>
              <p>
                <strong>Identifier:</strong> Alphabetical grade distinguishing learner achievement.
              </p>
              <p>
                <strong>Score:</strong> Refers to the average of the scores obtained from all
                learning outcomes.
              </p>
            </div>
          )}
        </section>}
          </>
        )}

        {modulePreferences.coCurricular && (
          <>
            <h2 className="section-title">CO CURRICULAR ACTIVITIES AND PROJECTS</h2>
            <table className="activities">
              <tbody>
                <tr>
                  <td>Games</td>
                  <td>{coCurricular.games}</td>
                </tr>
                <tr>
                  <td>Clubs</td>
                  <td>{coCurricular.clubs}</td>
                </tr>
                <tr>
                  <td>Projects</td>
                  <td>{coCurricular.projects}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <table className="comments">
          <tbody>
            {modulePreferences.comments && (
              <>
                <tr>
                  <td className="label">Class Teacher&apos;s Comment</td>
                  <td>{comments.classTeacher}</td>
                </tr>
                <tr>
                  <td className="label">Head Teacher&apos;s Comment</td>
                  <td>{comments.headTeacher}</td>
                </tr>
              </>
            )}
            <tr>
              <td className="label">
                <strong>Next term begins on</strong>
              </td>
              <td>{nextTermBeginsOn || "_____________________"}</td>
            </tr>
          </tbody>
        </table>

        <section className="signature-area">
          <div>
            <strong>Class Teacher</strong>
            {staff.classTeacher && (
              <span className="signature-name">{staff.classTeacher}</span>
            )}
            <hr className="signature-line" aria-hidden="true" />
          </div>
          <div>
            <strong>Head Teacher</strong>
            {staff.headTeacher && (
              <span className="signature-name">{staff.headTeacher}</span>
            )}
            <hr className="signature-line" aria-hidden="true" />
          </div>
        </section>
      </div>
    </div>
  );
}
