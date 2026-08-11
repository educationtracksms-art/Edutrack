import type { ReportCardData } from "@/lib/report-types";

export function ReportCard({ data }: { data: ReportCardData }) {
  const { school, student, attendance, rows, overall, approval, gradeKeys, coCurricular, comments, staff } =
    data;
  const watermarkLabel = school.name || "School";
  const paymentLabel =
    school.reportPaymentReferenceType === "account_number" ? "Account No." : "SchPay Code";
  const paymentValue =
    school.reportPaymentReferenceType === "account_number"
      ? school.reportAccountNumber || "_____________________"
      : student.schpayCode || "_____________________";

  return (
    <div className="report-doc">
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
          <tr className="title-row">
            <td colSpan={6}>{data.title}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="title">ASSESSMENT RESULTS SUMMARY</h2>
      <table className="results">
        <thead>
          <tr>
            <th>SUBJECT</th>
            <th>
              Formative
              <br />
              (20%)
            </th>
            <th>
              Summative
              <br />
              (80%)
            </th>
            <th>Total</th>
            <th>Grade</th>
            <th>Grade Descriptor</th>
            <th>Teacher</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.subject}>
              <td>{row.subject}</td>
              <td>{row.formative}</td>
              <td>{row.summative}</td>
              <td>{row.total}</td>
              <td>{row.grade}</td>
              <td>{row.gradeDescriptor}</td>
              <td>{row.teacher}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
                  <strong>Identifier out of three:</strong> {overall.identifier}
                </span>
                <span className="descriptor-block">
                  <strong>Descriptor:</strong> {overall.descriptor}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      

      <section className="definitions">
        <div className="keywords">
          <h3>KEY WORDS AND DEFINITION OF TERMS</h3>
          <table>
            <tbody>
              <tr>
                <th>Identifier</th>
                <th>Score Range</th>
                <th>Descriptor</th>
              </tr>
              {gradeKeys.map((key) => (
                <tr key={key.identifier}>
                  <td>{key.identifier}</td>
                  <td>{key.range}</td>
                  <td>{key.descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="meaning">
          <p>
            <strong>Competency:</strong> The overall expected capability of a learner after exposure
            to knowledge, skills and values.
          </p>
          <p>
            <strong>Descriptor:</strong> Gives details on the extent to which the learner has
            achieved the stipulated learning outcomes.
          </p>
          <p>
            <strong>Generic Skills:</strong> Higher order transferable skills applied in school and
            work.
          </p>
          <p>
            <strong>Identifier:</strong> Alphabetical grade distinguishing learner achievement.
          </p>
          <p>
            <strong>Score:</strong> Refers to the average of the scores obtained from all learning
            outcomes.
          </p>
        </div>
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
              {staff.classTeacher && (
                <>
                </>
              )}
            </td>
            <td>{comments.classTeacher}</td>
          </tr>
          <tr>
            <td className="label">Head Teacher's Comment</td>
            <td>{comments.headTeacher}</td>
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
  );
}
