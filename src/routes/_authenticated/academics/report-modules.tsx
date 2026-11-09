import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_REPORT_MODULE_PREFERENCES,
  parseReportModulePreferences,
  REPORT_MODULE_PREFERENCES_STORAGE_KEY,
  type ReportModulePreferences,
} from "@/lib/report-module-preferences";
import { isModuleEnabled } from "@/lib/modules";

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
  head: () => ({
    meta: [{ title: "Report modules | EduTrack" }],
  }),
  component: ReportModulesPage,
});

function ReportModulesPage() {
  const [prefs, setPrefs] = useState<ReportModulePreferences>(DEFAULT_REPORT_MODULE_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REPORT_MODULE_PREFERENCES_STORAGE_KEY);
      if (saved) setPrefs(parseReportModulePreferences(JSON.parse(saved)));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Could not load report module preferences: ${error.message}`
          : "Could not load report module preferences",
      );
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (prefs.paymentReferenceType === "account_number" && !prefs.accountNumber.trim()) {
      toast.error("Enter an account number for the report cards");
      return;
    }

    try {
      window.localStorage.setItem(REPORT_MODULE_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
      toast.success("Report module preferences saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Could not save report module preferences: ${error.message}`
          : "Could not save report module preferences",
      );
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic setup"
        title="Report modules"
        description="Choose which sections appear on generated report cards and set the payment reference."
      />
      <Panel title="Report card sections">
        <form className="space-y-5" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["grades", "Include grades"],
              ["comments", "Include teacher comments"],
              ["attendance", "Include attendance"],
              ["coCurricular", "Include co-curricular activities"],
              ["includeFeesBalance", "Include fees balance"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  id={`report-module-${key}`}
                  name="report-module"
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(event) =>
                    setPrefs((current) => ({ ...current, [key]: event.target.checked }))
                  }
                  className="rounded border"
                />
                {label}
              </label>
            ))}
          </div>

          <fieldset className="space-y-3 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Payment reference</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentReferenceType"
                  value="sch_pay"
                  checked={prefs.paymentReferenceType === "sch_pay"}
                  onChange={() =>
                    setPrefs((current) => ({ ...current, paymentReferenceType: "sch_pay" }))
                  }
                />
                School Pay code
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentReferenceType"
                  value="account_number"
                  checked={prefs.paymentReferenceType === "account_number"}
                  onChange={() =>
                    setPrefs((current) => ({
                      ...current,
                      paymentReferenceType: "account_number",
                    }))
                  }
                />
                Account number
              </label>
            </div>
            {prefs.paymentReferenceType === "account_number" ? (
              <Field label="Account number">
                <input
                  required
                  id="accountNumber"
                  type="text"
                  value={prefs.accountNumber}
                  onChange={(event) =>
                    setPrefs((current) => ({ ...current, accountNumber: event.target.value }))
                  }
                  placeholder="Enter the report-card account number"
                  className={inputClass}
                />
              </Field>
            ) : (
              <p className="text-sm text-muted-foreground">
                The learner&apos;s School Pay code will appear on the report card.
              </p>
            )}
          </fieldset>

          <div className="flex justify-end">
            <Btn type="submit" variant="accent" disabled={!isLoaded}>
              Save preferences
            </Btn>
          </div>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Saved preferences are applied the next time report cards are generated in this browser.
        </p>
      </Panel>
    </div>
  );
}
