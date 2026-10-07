import { Btn, Pill, ResponsiveTable } from "@/components/ui-kit";
import { ROLE_LABELS, type AppRole } from "./-data";

export interface AccountRow {
  id: string;
  full_name: string | null;
  email: string;
  initials: string | null;
  school_id: string | null;
  department_id: string | null;
  must_change_password: boolean;
  roles: AppRole[];
}

interface AccountsTableProps {
  people: AccountRow[] | undefined;
  isSuper: boolean;
  schoolNameFor: (id: string | null) => string | null;
  onReset: (person: AccountRow) => void;
  onEdit: (person: AccountRow) => void;
  onDelete: (person: AccountRow) => void;
}

function StatePill({ person }: { person: AccountRow }) {
  return person.must_change_password ? (
    <Pill tone="warning">Must reset</Pill>
  ) : (
    <Pill tone="success">Active</Pill>
  );
}

function RoleList({ roles }: { roles: AppRole[] }) {
  if (!roles.length) return <span className="text-xs text-muted-foreground">No role assigned</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Pill key={role} tone="muted">
          {ROLE_LABELS[role]}
        </Pill>
      ))}
    </div>
  );
}

function RowActions({
  person,
  onReset,
  onEdit,
  onDelete,
  compact,
}: {
  person: AccountRow;
  onReset: (p: AccountRow) => void;
  onEdit: (p: AccountRow) => void;
  onDelete: (p: AccountRow) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-4 grid grid-cols-3 gap-2" : "flex justify-end gap-2"}>
      <Btn variant="ghost" onClick={() => onReset(person)}>
        {compact ? "Reset" : "Reset password"}
      </Btn>
      <Btn variant="ghost" onClick={() => onEdit(person)}>
        Edit
      </Btn>
      <Btn variant="danger" onClick={() => onDelete(person)}>
        Delete
      </Btn>
    </div>
  );
}

export function AccountsTable(props: AccountsTableProps) {
  const { people, isSuper, schoolNameFor, onReset, onEdit, onDelete } = props;
  const rows = people ?? [];

  const confirmDelete = (person: AccountRow) => {
    if (window.confirm(`Delete the account for "${person.full_name || person.email}"?`)) {
      onDelete(person);
    }
  };

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-sm font-semibold">No accounts yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Create the first staff account so teachers and administrators can sign in.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveTable
      desktop={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Staff accounts with their roles, school and account state.
            </caption>
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Name
                </th>
                <th scope="col" className="px-4 py-3">
                  Email
                </th>
                {isSuper && (
                  <th scope="col" className="px-4 py-3">
                    School
                  </th>
                )}
                <th scope="col" className="px-4 py-3">
                  Roles
                </th>
                <th scope="col" className="px-4 py-3">
                  State
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((person) => (
                <tr
                  key={person.id}
                  className="border-t border-border align-top transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-medium">
                    {person.full_name || "—"}
                    {person.initials && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({person.initials})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{person.email}</td>
                  {isSuper && (
                    <td className="px-4 py-3">{schoolNameFor(person.school_id) || "—"}</td>
                  )}
                  <td className="px-4 py-3">
                    <RoleList roles={person.roles} />
                  </td>
                  <td className="px-4 py-3">
                    <StatePill person={person} />
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      person={person}
                      onReset={onReset}
                      onEdit={onEdit}
                      onDelete={confirmDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      mobile={rows.map((person) => (
        <div key={person.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {person.full_name || "—"}
                {person.initials && (
                  <span className="ml-2 text-xs text-muted-foreground">({person.initials})</span>
                )}
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{person.email}</p>
              {isSuper && (
                <p className="mt-1 text-xs text-muted-foreground">
                  School: {schoolNameFor(person.school_id) || "—"}
                </p>
              )}
            </div>
            <StatePill person={person} />
          </div>
          <div className="mt-3">
            <RoleList roles={person.roles} />
          </div>
          <RowActions
            person={person}
            onReset={onReset}
            onEdit={onEdit}
            onDelete={confirmDelete}
            compact
          />
        </div>
      ))}
    />
  );
}

