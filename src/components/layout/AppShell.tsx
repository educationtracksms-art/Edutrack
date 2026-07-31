import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CalendarCheck,
  ClipboardCheck,
  FileBadge,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  MoveUpRight,
  ScrollText,
  Settings2,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  ACADEMIC_MANAGERS,
  ROLE_LABELS,
  SCHOOL_ROLES,
  hasAny,
  useCurrentUser,
  type AppRole,
} from "@/hooks/useCurrentUser";
import logoUrl from "@/assets/logo.png";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; roles: AppRole[] };

const ALL: AppRole[] = [
  "super_admin",
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "class_teacher",
  "subject_teacher",
];

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { to: "/schools", label: "Schools", icon: Building2, roles: ["super_admin"] },
  {
    to: "/students",
    label: "Students",
    icon: GraduationCap,
    roles: ["school_admin", "head_teacher", "deputy_head_teacher", "dos", "class_teacher"],
  },
  { to: "/academics", label: "Academic setup", icon: Library, roles: ACADEMIC_MANAGERS },
  { to: "/timetable", label: "Timetable", icon: CalendarClock, roles: SCHOOL_ROLES },
  {
    to: "/assessments",
    label: "Assessments",
    icon: ClipboardCheck,
    roles: ["dos", "school_admin", "head_teacher", "deputy_head_teacher", "subject_teacher", "class_teacher"],
  },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarCheck,
    roles: ["class_teacher", "dos", "school_admin", "head_teacher", "deputy_head_teacher"],
  },
  {
    to: "/reports",
    label: "Report Cards",
    icon: FileBadge,
    roles: ["school_admin", "head_teacher", "deputy_head_teacher", "dos", "class_teacher"],
  },
  { to: "/promotions", label: "Promotions", icon: MoveUpRight, roles: ACADEMIC_MANAGERS },
  { to: "/users", label: "Users & Roles", icon: Users, roles: ["super_admin", "school_admin"] },
  {
    to: "/settings",
    label: "School Settings",
    icon: Settings2,
    roles: ["school_admin", "head_teacher", "deputy_head_teacher"],
  },
  {
    to: "/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    roles: ["super_admin", "school_admin", "head_teacher"],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((item) => hasAny(me?.roles, item.roles));
  const primaryRole = me?.roles?.[0];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <img src={logoUrl} alt="EduTrack logo" className="h-10 w-10 rounded-full bg-white object-cover" />
          <div>
            <p className="text-sm font-semibold leading-tight">EduTrack</p>
            <p className="text-xs text-sidebar-foreground/60">School Management</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <p className="truncate font-medium">{me?.profile?.full_name || me?.email}</p>
          <p className="text-sidebar-foreground/60">
            {primaryRole ? ROLE_LABELS[primaryRole] : "No role assigned"}
          </p>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-2 rounded-md bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground transition-colors hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-border bg-background px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {me?.school?.name ?? "Platform Administration"}
            </p>
            <p className="text-xs text-muted-foreground">
              {primaryRole ? ROLE_LABELS[primaryRole] : ""}
            </p>
          </div>
          <div className="flex gap-2 md:hidden">
            {items.slice(0, 4).map((item) => (
              <Link key={item.to} to={item.to} className="rounded-md border border-border p-2">
                <item.icon className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
