import type { ReportCardData } from "@/lib/report-types";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

export function ReportCard({ data }: { data: ReportCardData }) {
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
  const watermarkLabel = school.name || "School";
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [printScale, setPrintScale] = useState(1);
  const paymentLabel =
    school.reportPaymentReferenceType === "account_number" ? "Account No." : "SchPay Code";
  const paymentValue =
    school.reportPaymentReferenceType === "account_number"
      ? school.reportAccountNumber || "_____________________"
      : student.schpayCode || "_____________________";
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

    const updateScale = () => {
      const height = node.scrollHeight;
      const width = node.scrollWidth;
      const pageHeight = 1122;
      const pageWidth = 794;
      const heightScale = pageHeight / Math.max(height, 1);
      const widthScale = pageWidth / Math.max(width, 1);
      const nextScale = Math.min(1, heightScale, widthScale, 0.98);
      setPrintScale(Number.isFinite(nextScale) ? Math.max(0.55, nextScale) : 1);
    };

    updateScale();
    const raf = window.requestAnimationFrame(updateScale);
    window.addEventListener("beforeprint", updateScale);
    window.addEventListener("resize", updateScale);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("beforeprint", updateScale);
      window.removeEventListener("resize", updateScale);
    };
  }, [data]);

  return (
    <div
      ref={reportRef}
      className={`report-doc ${isAdvanced ? "advanced-report" : ""}`}
      style={{ "--print-scale": printScale } as CSSProperties}
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
          <tbody>
            <tr>
              <td className="label-lin">LIN:</td>
              <td className="value-lin">{student.lin}</td>
              <td className="label-name">Name:</td>
              <td className="value-name">{student.name}</td>
              <td className="attendance-cell" rowSpan={4}>
                {attendance && (
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
              <td className="passport-cell" rowSpan={4}>
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
              {student.feesBalance !== null ? (
                <>
                  <td className="label-small">Fees Bal:</td>
                  <td className="value-small">{student.feesBalance}</td>
                </>
              ) : (
                <>
                  <td className="label-small" />
                  <td className="value-small" />
                </>
              )}
            </tr>
            <tr>
              <td className="label-small">House:</td>
              <td className="value-small">{student.house || "_____________________"}</td>
              <td className="label-small">Class / Stream:</td>
              <td className="value-small">{student.classStream}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="title">ASSESSMENT RESULTS SUMMARY</h2>
        <table className="results">
          <colgroup>
            <col className="results-subject-col" />
            {isAdvanced && <col className="results-paper-col" />}
            <col className="results-formative-col" />
            {activeSummativePeriods.map((period) => (
              <col className="results-summative-col" key={period} />
            ))}
            <col className="results-total-col" />
            {isAdvanced && <col className="results-average-col" />}
            <col className="results-grade-col" />
            <col className="results-descriptor-col" />
            <col className="results-teacher-col" />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={isAdvanced ? 2 : 1}>SUBJECT</th>
              {isAdvanced ? null : null}
              <th>
                Formative
                <br />
                (20%)
              </th>
              <th colSpan={activeSummativePeriods.length}>
                Summative (80%)
              </th>
              <th>Total</th>
              {isAdvanced && <th>TOTAL A/V</th>}
              <th>Grade</th>
              <th>{isAdvanced ? "Points" : "Grade Descriptor"}</th>
              <th>Teacher</th>
            </tr>
            <tr>
              <th />
              {isAdvanced && <th />}
              <th />
              {activeSummativePeriods.map((period) => <th key={period}>{period}</th>)}
              <th />
              <th />
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {isAdvanced
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
                      <td>{row.formative}</td>
                      {activeSummativePeriods.map((period) => (
                        <td key={period}>
                          {period === "BOT" ? row.bot : period === "MOT" ? row.mot : row.eot}
                        </td>
                      ))}
                      <td>{row.total}</td>
                      {index === 0 && (
                        <>
                          <td rowSpan={group.papers.length}>{summary?.totalAverage ?? ""}</td>
                          <td rowSpan={group.papers.length}>{summary?.grade ?? ""}</td>
                          <td rowSpan={group.papers.length}>{summary?.subjectPoints ?? ""}</td>
                        </>
                      )}
                      <td>{row.teacher}</td>
                    </tr>
                  ));
                })
              : rows.map((row) => (
                  <tr key={`${row.subject}-${row.paperId ?? "summary"}`}>
                    <td>{row.subject}</td>
                    <td>{row.formative}</td>
                    {activeSummativePeriods.map((period) => (
                      <td key={period}>
                        {period === "BOT" ? row.bot : period === "MOT" ? row.mot : row.eot}
                      </td>
                    ))}
                    <td>{row.total}</td>
                    <td>{row.grade}</td>
                    <td>{row.gradeDetail}</td>
                    <td>{row.teacher}</td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isAdvanced && (
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

        <section className="definitions">
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
        </section>

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

        <table className="comments">
          <tbody>
            <tr>
              <td className="label">
                Class Teacher&apos;s Comment
                {staff.classTeacher && <></>}
              </td>
              <td>{comments.classTeacher}</td>
            </tr>
            <tr>
              <td className="label">Head Teacher&apos;s Comment</td>
              <td>{comments.headTeacher}</td>
            </tr>
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
              <>
                <br />
                {staff.classTeacher}
              </>
            )}
            <br />
            <br />
            <br />
            _______________________
          </div>
          <div>
            <strong>Head Teacher</strong>
            {staff.headTeacher && (
              <>
                <br />
                {staff.headTeacher}
              </>
            )}
            <br />
            <br />
            <br />
            _______________________
          </div>
        </section>
      </div>
    </div>
  );
}
