// bursar portal — maintain the independent payroll staff register
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Field, PageHeader, Panel, Pill, Stat, inputClass } from "@/components/ui-kit";
import { asNumber, money, useFinanceContext, useFinanceSettings } from "@/lib/bursar";
import { deletePayrollStaff, listPayrollStaff, upsertPayrollStaff } from "@/lib/bursar.functions";
import { friendlyAdminError } from "@/lib/admin-errors";
import { requireFinanceAccess } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/finance-payroll-staff")({
  beforeLoad: ({ context }) => requireFinanceAccess(context),
  head: () => ({ meta: [{ title: "Payroll staff register · EduTrack" }] }),
  component: FinancePayrollStaffPage,
});

type Category = "teacher" | "non_teaching" | "cleaner" | "cook" | "porter" | "other";
type Employment = "permanent" | "contract" | "casual";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "teacher", label: "Teacher" },
  { value: "non_teaching", label: "Non-teaching" },
  { value: "cleaner", label: "Cleaner" },
  { value: "cook", label: "Cook" },
  { value: "porter", label: "Porter" },
  { value: "other", label: "Other" },
];

const EMPLOYMENTS: { value: Employment; label: string }[] = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "casual", label: "Casual" },
];

const EMPTY_FORM = {
  id: null as string | null,
  fullName: "",
  staffCategory: "teacher" as Category,
  employeeNumber: "",
  nationalId: "",
  taxPin: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  basicSalary: "",
  allowances: "0",
  deductions: "0",
  employmentType: "permanent" as Employment,
  dateOfEmployment: "",
  status: "active" as "active" | "inactive",
  notes: "",
};

function FinancePayrollStaffPage() {
  const queryClient = useQueryClient();
  const { schoolId, canView, canManage } = useFinanceContext();
  const { data: settings } = useFinanceSettings(schoolId);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["payroll-staff", schoolId],
    enabled: !!schoolId && canView,
    queryFn: () => listPayrollStaff(),
  });

  // __CHUNK2__ — mutations for register / edit / remove

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payroll-staff", schoolId] });

  const save = useMutation({
    mutationFn: () =>
      upsertPayrollStaff({
        data: {
          schoolId: schoolId!,
          id: form.id,
          fullName: form.fullName.trim(),
          staffCategory: form.staffCategory,
          employeeNumber: form.employeeNumber.trim(),
          nationalId: form.nationalId.trim() || null,
          taxPin: form.taxPin.trim() || null,
          bankName: form.bankName.trim() || null,
          accountName: form.accountName.trim() || null,
          accountNumber: form.accountNumber.trim() || null,
          basicSalary: Number(form.basicSalary),
          allowances: Number(form.allowances || 0),
          deductions: Number(form.deductions || 0),
          employmentType: form.employmentType,
          dateOfEmployment: form.dateOfEmployment || null,
          status: form.status,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: (res: any) => {
      toast.success(res?.updated ? "Staff record updated" : "Staff registered");
      setForm(EMPTY_FORM);
      setEditing(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const remove = useMutation({
    mutationFn: () => deletePayrollStaff({ data: { id: deleteTarget!, schoolId: schoolId! } }),
    onSuccess: () => {
      toast.success("Staff record deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(friendlyAdminError(error)),
  });

  const startEdit = (row: any) => {
    setForm({
      id: row.id,
      fullName: row.full_name ?? "",
      staffCategory: row.staff_category ?? "teacher",
      employeeNumber: row.employee_number ?? "",
      nationalId: row.national_id ?? "",
      taxPin: row.tax_pin ?? "",
      bankName: row.bank_name ?? "",
      accountName: row.account_name ?? "",
      accountNumber: row.account_number ?? "",
      basicSalary: String(row.basic_salary ?? ""),
      allowances: String(row.allowances ?? 0),
      deductions: String(row.deductions ?? 0),
      employmentType: row.employment_type ?? "permanent",
      dateOfEmployment: row.date_of_employment ?? "",
      status: row.status ?? "active",
      notes: row.notes ?? "",
    });
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // __CHUNK3__ — register form fields

  const rows = ((data ?? []) as any[]).filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${r.full_name} ${r.employee_number ?? ""}`.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === "all" || r.staff_category === categoryFilter;
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const activeCount = rows.filter((r) => r.status === "active").length;
  const wageBill = rows
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + asNumber(r.basic_salary) + asNumber(r.allowances) - asNumber(r.deductions), 0);

  if (!canView) {
    return <PageHeader title="Payroll staff register" description="You do not have permission to view this area." />;
  }

  const valid = form.fullName.trim() && form.employeeNumber.trim() && form.basicSalary;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll staff register"
        description="Register every earner on the payroll — teachers, non-teaching staff, cleaners, cooks and porters."
        eyebrow="Bursar · Payroll"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Staff on register" value={rows.length} hint={`${activeCount} active`} />
        <Stat label="Monthly wage bill" value={money(wageBill, settings)} hint="Active staff, net" />
        <Stat label="Categories" value={CATEGORIES.filter((c) => rows.some((r) => r.staff_category === c.value)).length} hint="Represented on register" />
      </div>

      {canManage ? (
        <Panel title={form.id ? "Edit staff record" : "Register staff member"}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Full name">
              <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Namono" />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={form.staffCategory} onChange={(e) => setForm({ ...form, staffCategory: e.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Employee / file number">
              <input className={inputClass} value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} placeholder="STF-001" />
            </Field>
            <Field label="Employment type">
              <select className={inputClass} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as Employment })}>
                {EMPLOYMENTS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="National ID (optional)">
              <input className={inputClass} value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="CMF…" />
            </Field>
            <Field label="Tax PIN (optional)">
              <input className={inputClass} value={form.taxPin} onChange={(e) => setForm({ ...form, taxPin: e.target.value })} placeholder="TIN…" />
            </Field>
            <Field label="Bank name (optional)">
              <input className={inputClass} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Stanbic" />
            </Field>
            <Field label="Account name (optional)">
              <input className={inputClass} value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="Jane Namono" />
            </Field>
            <Field label="Account number (optional)">
              <input className={inputClass} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="903…" />
            </Field>
            {/* __FORM2__ */}
            <Field label="Basic salary (UGX)">
              <input className={inputClass} type="number" min="0" step="1" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Allowances (UGX)">
              <input className={inputClass} type="number" min="0" step="1" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Deductions (UGX)">
              <input className={inputClass} type="number" min="0" step="1" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} inputMode="numeric" placeholder="0" />
            </Field>
            <Field label="Date of employment">
              <input className={inputClass} type="date" value={form.dateOfEmployment} onChange={(e) => setForm({ ...form, dateOfEmployment: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Notes (optional)" className="md:col-span-2 xl:col-span-3">
              <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional note" />
            </Field>
            <div className="flex items-end gap-2">
              <Btn variant="accent" onClick={() => save.mutate()} disabled={save.isPending || !valid}>
                {save.isPending ? "Saving…" : form.id ? "Update record" : "Register"}
              </Btn>
              {editing || form.id ? (
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Btn>
              ) : (
                <Btn variant="ghost" onClick={() => setForm(EMPTY_FORM)}>
                  Clear
                </Btn>
              )}
            </div>
          </div>
        </Panel>
      ) : null}

      {/* __LIST__ — register table and delete confirmation */}
      <Panel title={`Staff register (${rows.length})`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            className="min-w-[180px] flex-1 rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or file number"
          />
          <select
            className="w-auto rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            className="w-auto rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Active + inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {isPending ? (
          <p className="py-8 text-sm text-muted-foreground">Loading register…</p>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nobody on the register yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Use the form above to register the first staff member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">File no.</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3 text-right">Basic</th>
                  <th className="pb-2 pr-3 text-right">Net</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const net = asNumber(row.basic_salary) + asNumber(row.allowances) - asNumber(row.deductions);
                  return (
                    <tr key={row.id} className="border-t align-top">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{row.full_name}</p>
                        <p className="text-xs text-muted-foreground">{row.bank_name ? `${row.bank_name} · ${row.account_number ?? "—"}` : "No bank details"}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{row.employee_number}</td>
                      <td className="py-2.5 pr-3">
                        <Pill tone="muted">{String(row.staff_category).replace("_", " ")}</Pill>
                      </td>
                      <td className="py-2.5 pr-3 text-right">{money(row.basic_salary, settings)}</td>
                      <td className="py-2.5 pr-3 text-right font-medium">{money(net, settings)}</td>
                      <td className="py-2.5 pr-3 text-xs">{row.employment_type}</td>
                      <td className="py-2.5 pr-3">
                        <Pill tone={row.status === "active" ? "success" : "muted"}>{row.status}</Pill>
                      </td>
                      <td className="py-2.5">
                        {canManage ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Btn variant="ghost" onClick={() => startEdit(row)}>
                              Edit
                            </Btn>
                            <Btn variant="ghost" onClick={() => setDeleteTarget(row.id)}>
                              Delete
                            </Btn>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {deleteTarget && (
          <Panel title="Delete staff record" className="mt-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-muted-foreground">
              This permanently removes the staff member from the payroll register. Prefer switching them to inactive if they may return.
            </p>
            <div className="mt-3 flex gap-2">
              <Btn variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                {remove.isPending ? "Deleting…" : "Confirm delete"}
              </Btn>
              <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Btn>
            </div>
          </Panel>
        )}
      </Panel>
    </div>
  );
}
