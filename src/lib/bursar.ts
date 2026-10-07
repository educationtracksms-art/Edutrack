import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasAny, type AppRole } from "@/hooks/useCurrentUser";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/finance-calc";

/**
 * Finance is a Bursar-only area. `super_admin` is intentionally absent: platform
 * administration is handled under /schools and /subscriptions, and finance is
 * always scoped to a single school. Adding a role here also requires adding it to
 * FINANCE_ROUTE_ROLES in `@/lib/route-guards` and to the SQL policy helpers
 * `public.can_manage_finance()` / `public.finance_can_read()`.
 */
export const FINANCE_VIEW_ROLES: AppRole[] = ["bursar"];

export const FINANCE_MANAGE_ROLES: AppRole[] = ["bursar"];

/** Payment methods accepted across Uganda. M-Pesa and SchoolPay are forbidden. */
export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "mtn_mobile_money", label: "MTN Mobile Money" },
  { value: "other", label: "Other" },
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label]),
);

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PAYMENT_METHOD_LABELS[value] ?? value;
}

export function useFinanceContext() {
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  const canView = !!schoolId && hasAny(me?.roles, FINANCE_VIEW_ROLES);
  const canManage = !!schoolId && hasAny(me?.roles, FINANCE_MANAGE_ROLES);
  return { me, schoolId, canView, canManage, db: supabase as any };
}

export function useFinanceSettings(schoolId: string | null) {
  return useQuery({
    queryKey: ["finance-settings", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_settings")
        .select("*")
        .eq("school_id", schoolId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}

export function financeCurrency(settings: any): string {
  const currency = String(settings?.currency ?? DEFAULT_CURRENCY).toUpperCase();
  return currency || DEFAULT_CURRENCY;
}

export function money(amount: number | string | null | undefined, settings?: any): string {
  return formatMoney(amount, financeCurrency(settings));
}

export function financeQueryKeys(schoolId: string | null) {
  return [
    ["finance-dashboard", schoolId],
    ["bursar-dashboard", schoolId],
    ["bursar-invoices", schoolId],
    ["bursar-payments", schoolId],
    ["bursar-receivables", schoolId],
    ["bursar-fees", schoolId],
    ["bursar-expenses", schoolId],
    ["bursar-procurement", schoolId],
    ["bursar-banking", schoolId],
    ["bursar-accounting", schoolId],
    ["bursar-budgets", schoolId],
    ["bursar-payroll", schoolId],
    ["bursar-assets", schoolId],
    ["bursar-grants", schoolId],
    ["bursar-reports", schoolId],
    ["bursar-approvals", schoolId],
    ["bursar-settings", schoolId],
  ];
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function startOfMonthIso(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}
