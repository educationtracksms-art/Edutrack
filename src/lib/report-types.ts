export type SubjectRow = {
  subject: string;
  formative: string;
  summative: string;
  total: string;
  grade: string;
  descriptor: string;
  teacher: string;
};

export type GradeKey = {
  identifier: string;
  range: string;
  descriptor: string;
};

export type ReportCardData = {
  studentId: string;
  school: {
    name: string;
    address: string;
    email: string;
    phone: string;
    logoUrl: string | null;
    initials: string;
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
  overall: { average: string; identifier: string; descriptor: string };
  gradeKeys: GradeKey[];
  coCurricular: { games: string; clubs: string; projects: string };
  comments: { classTeacher: string; headTeacher: string };
};