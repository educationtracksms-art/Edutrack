export type SubjectRow = {
  subject: string;
  formative: string;
  summative: string;
  total: string;
  grade: string;
  gradeDetail: string;
  subjectPoints: string;
  teacher: string;
};

export type ReportApproval = {
  name: string;
  role: string;
  approvedAt: string;
};

export type GradeKey = {
  identifier: string;
  range: string;
  detail: string;
};

export type ReportCardData = {
  studentId: string;
  gradingLevel: "ordinary" | "advanced";
  school: {
    name: string;
    motto: string | null;
    address: string;
    email: string;
    phone: string;
    logoUrl: string | null;
    initials: string;
    reportPaymentReferenceType: "schpay_code" | "account_number";
    reportAccountNumber: string | null;
    reportNextTermBeginsOn: string | null;
  };
  title: string;
  student: {
    lin: string;
    name: string;
    schpayCode: string;
    feesBalance: string | null;
    house: string;
    classStream: string;
    photoUrl: string | null;
  };
  attendance: { present: number; absent: number; total: number } | null;
  rows: SubjectRow[];
  overall: { average: string; metricLabel: string; metric: string; descriptor: string };
  totalPoints: number | null;
  approval: ReportApproval | null;
  gradeKeys: GradeKey[];
  coCurricular: { games: string; clubs: string; projects: string };
  comments: { classTeacher: string; headTeacher: string };
  staff: { classTeacher: string; headTeacher: string };
};
