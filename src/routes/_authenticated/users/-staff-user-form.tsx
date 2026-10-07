import { useState } from "react";

import { Btn, Field, inputClass } from "@/components/ui-kit";
import { ROLE_LABELS, useCurrentUser, type AppRole } from "@/hooks/useCurrentUser";
import {
  ASSIGNABLE,
  DEPARTMENT_REQUIRED_ROLES,
  useSchoolDepartments,
  type StaffUserFormValues,
} from "./-data";

export interface StaffUserFormProps {
  isSuper: boolean;
  schools: any[] | undefined;
  mode: "create" | "edit";
  initial?: StaffUserFormValues;
  submitting?: boolean;
  issued?: { email: string; password: string } | null;
  onSubmit: (form: StaffUserFormValues) => void;
  onCancel?: () => void;
}

export const DEFAULT_STAFF_FORM: StaffUserFormValues = {
  fullName: "",
  email: "",
  role: "subject_teacher",
  initials: "",
  schoolId: "",
  departmentId: "",
};

/** Field-level problems are surfaced on blur, never on every keystroke. */
function validate(form: StaffUserFormValues, isSuper: boolean) {
  const errors: Partial<Record<keyof StaffUserFormValues, string>> = {};
  if (!form.fullName.trim()) errors.fullName = "Enter the staff member's full name.";
  if (!form.email.trim()) errors.email = "Enter an email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "That email address looks incomplete.";
  if (isSuper && !form.schoolId) errors.schoolId = "Choose the school this account belongs to.";
  return errors;
}

export function StaffUserForm(props: StaffUserFormProps) {
  const { isSuper, schools, mode, initial, submitting, issued, onSubmit, onCancel } = props;

  const [form, setForm] = useState<StaffUserFormValues>(initial ?? DEFAULT_STAFF_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof StaffUserFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  // The department list belongs to one school: a super administrator's own
  // school is unknown, so it follows the school picked in this form instead.
  const { data: me } = useCurrentUser();
  const ownSchoolId = me?.profile?.school_id ?? null;
  const { data: departments, isPending: departmentsPending } = useSchoolDepartments(
    isSuper ? form.schoolId : ownSchoolId,
  );

  const errors = validate(form, isSuper);
  const showError = (key: keyof StaffUserFormValues) => (touched[key] || submitted) && errors[key];
  const departmentRequired = DEPARTMENT_REQUIRED_ROLES.includes(form.role);
  const markTouched = (key: keyof StaffUserFormValues) =>
    setTouched((current) => ({ ...current, [key]: true }));

  const fieldHint = (key: keyof StaffUserFormValues, hint?: string) => {
    const error = showError(key);
    if (!error) return hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null;
    return (
      <p className="mt-1 text-xs font-medium text-destructive" role="alert">
        {error}
      </p>
    );
  };

  const errorRing = (key: keyof StaffUserFormValues) =>
    showError(key) ? " border-destructive focus:border-destructive focus:ring-destructive/15" : "";

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(errors).length) return;
        onSubmit(form);
      }}
    >
      {isSuper && (
        <Field label="School">
          <select
            className={`${inputClass}${errorRing("schoolId")}`}
            value={form.schoolId}
            aria-invalid={showError("schoolId") ? true : undefined}
            onBlur={() => markTouched("schoolId")}
            onChange={(e) => setForm({ ...form, schoolId: e.target.value, departmentId: "" })}
          >
            <option value="">Select a school</option>
            {(schools ?? []).map((school: any) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
          {fieldHint("schoolId")}
        </Field>
      )}

      <Field label="Full name">
        <input
          className={`${inputClass}${errorRing("fullName")}`}
          value={form.fullName}
          autoComplete="name"
          aria-invalid={showError("fullName") ? true : undefined}
          onBlur={() => markTouched("fullName")}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        {fieldHint("fullName")}
      </Field>

      <Field label="Email">
        <input
          type="email"
          className={`${inputClass}${errorRing("email")}`}
          value={form.email}
          autoComplete="email"
          aria-invalid={showError("email") ? true : undefined}
          onBlur={() => markTouched("email")}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {fieldHint("email", "Used for sign-in and password resets.")}
      </Field>

      <Field label="Initials (optional)">
        <input
          className={inputClass}
          value={form.initials}
          maxLength={4}
          placeholder="e.g. JKM"
          onChange={(e) => setForm({ ...form, initials: e.target.value })}
        />
        {fieldHint("initials", "Shown on report cards.")}
      </Field>

      <Field label="Role">
        <select
          className={inputClass}
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as AppRole, departmentId: "" })}
        >
          {ASSIGNABLE.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>

      <Field label={departmentRequired ? "Department" : "Department (optional)"}>
        <select
          className={inputClass}
          value={form.departmentId}
          disabled={isSuper && !form.schoolId}
          onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
        >
          <option value="">
            {isSuper && !form.schoolId
              ? "Choose a school first"
              : departmentRequired
                ? "Select department"
                : "No department"}
          </option>
          {(departments ?? []).map((department: any) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        {fieldHint(
          "departmentId",
          isSuper && !form.schoolId
            ? "Departments appear once the school is selected."
            : departmentsPending
              ? "Loading departments…"
              : (departments ?? []).length === 0
                ? "No departments exist for this school yet. Create one on the Departments tab."
                : departmentRequired
                  ? "This role belongs to a department."
                  : "Optional for this role.",
        )}
      </Field>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
        )}
        <Btn type="submit" variant="accent" disabled={submitting}>
          {submitting
            ? mode === "create"
              ? "Creating\u2026"
              : "Saving\u2026"
            : mode === "create"
              ? "Create account"
              : "Save changes"}
        </Btn>
      </div>

      {issued && (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm">
          <p className="font-semibold">One-time password</p>
          <p className="mt-1 break-all text-muted-foreground">{issued.email}</p>
          <p className="mt-1 font-mono text-base">{issued.password}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Share this once — the account holder changes it at first sign in.
          </p>
        </div>
      )}
    </form>
  );
}

