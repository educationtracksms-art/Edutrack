import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isModuleEnabled } from "@/lib/modules";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/academics/report-modules")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw redirect({ to: "/auth" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();

    if (!(await isModuleEnabled(supabase, profile?.school_id ?? null, "academics"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ReportModulesPage,
});

function ReportModulesPage() {
  const { data: me } = useCurrentUser();

  // Load saved preferences from localStorage, or defaults
  const [prefs, setPrefs] = useState<{
    grades: boolean;
    comments: boolean;
    attendance: boolean;
    coCurricular: boolean;
    includeFeesBalance: boolean;
    paymentReferenceType: "account_number" | "sch_pay";
    accountNumber: string;
  }>(() => {
    const saved = localStorage.getItem("report-modules-prefs");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        grades: parsed.grades ?? true,
        comments: parsed.comments ?? true,
        attendance: parsed.attendance ?? true,
        coCurricular: parsed.coCurricular ?? true,
        includeFeesBalance: parsed.includeFeesBalance ?? true,
        paymentReferenceType: parsed.paymentReferenceType ?? "sch_pay",
        accountNumber: parsed.accountNumber ?? "",
      };
    }
    return {
      grades: true,
      comments: true,
      attendance: true,
      coCurricular: true,
      includeFeesBalance: true,
      paymentReferenceType: "sch_pay",
      accountNumber: "",
    };
  });

  const handleSave = () => {
    localStorage.setItem("report-modules-prefs", JSON.stringify(prefs));
    alert("Report modules preferences saved.");
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Report Modules</h2>

      <form className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.grades}
            onChange={(e) => setPrefs((p) => ({ ...p, grades: e.target.checked }))}
            className="rounded border"
          />
          <span className="text-sm">Include grades</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.comments}
            onChange={(e) => setPrefs((p) => ({ ...p, comments: e.target.checked }))}
            className="rounded border"
          />
          <span className="text-sm">Include teacher comments</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.attendance}
            onChange={(e) => setPrefs((p) => ({ ...p, attendance: e.target.checked }))}
            className="rounded border"
          />
          <span className="text-sm">Include attendance</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.coCurricular}
            onChange={(e) => setPrefs((p) => ({ ...p, coCurricular: e.target.checked }))}
            className="rounded border"
          />
          <span className="text-sm">Include co‑curricular</span>
        </div>

<div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.includeFeesBalance}
            onChange={(e) => setPrefs((p) => ({ ...p, includeFeesBalance: e.target.checked }))}
            className="rounded border"
          />
          <span className="text-sm">Include fees balance</span>
        </div>

        <fieldset className="border p-4 rounded">
          <legend className="font-semibold">Payment reference type</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentType"
                value="sch_pay"
                checked={prefs.paymentReferenceType === "sch_pay"}
                onChange={() => setPrefs((p) => ({ ...p, paymentReferenceType: "sch_pay" }))}
                className="rounded border"
              />
              <span>School Pay code (SchPay)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentType"
                value="account_number"
                checked={prefs.paymentReferenceType === "account_number"}
                onChange={() => setPrefs((p) => ({ ...p, paymentReferenceType: "account_number" }))}
                className="rounded border"
              />
              <span>Account number</span>
            </label>
          </div>

          {prefs.paymentReferenceType === "account_number" ? (
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="accountNumber" className="text-sm">
                Account number:
                <input
                  id="accountNumber"
                  type="text"
                  value={prefs.accountNumber}
                  onChange={(e) => setPrefs((p) => ({ ...p, accountNumber: e.target.value }))}
                  placeholder="e.g. 1234567890"
                  className="rounded border w-32 px-2 py-1 text-sm"
                />
              </label>
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">
              SchPay code will be used instead of account number.
            </div>
          )}
        </fieldset>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save preferences
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        These settings control which sections appear on generated report cards.
        Changes are saved locally and will take effect for new reports.
      </p>
    </div>
  );
}