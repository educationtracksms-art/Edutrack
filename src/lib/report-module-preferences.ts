export type ReportModulePreferences = {
  grades: boolean;
  comments: boolean;
  attendance: boolean;
  coCurricular: boolean;
  includeFeesBalance: boolean;
  paymentReferenceType: "account_number" | "sch_pay";
  accountNumber: string;
};

export const DEFAULT_REPORT_MODULE_PREFERENCES: ReportModulePreferences = {
  grades: true,
  comments: true,
  attendance: true,
  coCurricular: true,
  includeFeesBalance: true,
  paymentReferenceType: "sch_pay",
  accountNumber: "",
};

export const REPORT_MODULE_PREFERENCES_STORAGE_KEY = "report-modules-prefs";

export function parseReportModulePreferences(value: unknown): ReportModulePreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saved report module preferences are invalid");
  }

  const saved = value as Record<string, unknown>;
  const booleanPreference = (key: keyof Pick<
    ReportModulePreferences,
    "grades" | "comments" | "attendance" | "coCurricular" | "includeFeesBalance"
  >) => {
    const preference = saved[key];
    if (preference === undefined) return DEFAULT_REPORT_MODULE_PREFERENCES[key];
    if (typeof preference !== "boolean") {
      throw new Error(`Saved report module preference "${key}" is invalid`);
    }
    return preference;
  };
  const paymentReferenceType = saved.paymentReferenceType;
  if (
    paymentReferenceType !== undefined &&
    paymentReferenceType !== "account_number" &&
    paymentReferenceType !== "sch_pay"
  ) {
    throw new Error("Saved payment reference preference is invalid");
  }
  const accountNumber = saved.accountNumber;
  if (accountNumber !== undefined && typeof accountNumber !== "string") {
    throw new Error("Saved account number preference is invalid");
  }

  return {
    grades: booleanPreference("grades"),
    comments: booleanPreference("comments"),
    attendance: booleanPreference("attendance"),
    coCurricular: booleanPreference("coCurricular"),
    includeFeesBalance: booleanPreference("includeFeesBalance"),
    paymentReferenceType:
      paymentReferenceType === "account_number" ? "account_number" : "sch_pay",
    accountNumber: accountNumber ?? DEFAULT_REPORT_MODULE_PREFERENCES.accountNumber,
  };
}
