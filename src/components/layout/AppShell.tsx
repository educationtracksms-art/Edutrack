import * as React from "react";
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
  PanelLeftClose,
  Search,
  ShieldCheck,
  LayoutGrid,
  Bell,
  ChevronRight,
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
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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

const QUICK_ACTIONS = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/audit-logs", label: "Audit trail", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const items = NAV.filter((item) => hasAny(me?.roles, item.roles));
  const primaryRole = me?.roles?.[0];
  const primaryActionItems = items.slice(0, 6);

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
        <header className="no-print flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {me?.school?.name ?? "Platform Administration"}
              </p>
              <p className="text-xs text-muted-foreground">
                {primaryRole ? ROLE_LABELS[primaryRole] : ""}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm border-r-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Mobile navigation for the EduTrack dashboard.</SheetDescription>
          </SheetHeader>

          <div className="flex h-full flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="EduTrack logo" className="h-11 w-11 rounded-full bg-white object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">EduTrack</p>
                  <p className="truncate text-xs text-slate-300">
                    {me?.school?.name ?? "Platform Administration"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {QUICK_ACTIONS.map((action) => {
                  const active = pathname === action.to;
                  return (
                    <Link
                      key={action.to}
                      to={action.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border px-3 py-3 text-center text-xs transition",
                        active
                          ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-200"
                          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                      )}
                    >
                      <action.icon className="mb-1 h-4 w-4" />
                      <span>{action.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                <span>Current role</span>
                <span>{primaryRole ? ROLE_LABELS[primaryRole] : "No role"}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3">
              <div className="px-2 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Main menu
              </div>
              <nav className="space-y-1">
                {primaryActionItems.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
                        active
                          ? "bg-white/12 text-white shadow-sm"
                          : "text-slate-200 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="h-4 w-4 opacity-60" />
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 px-2 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                More
              </div>
              <nav className="space-y-1">
                {items.slice(6).map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
                        active
                          ? "bg-white/12 text-white"
                          : "text-slate-200 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-white/10 p-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="truncate text-sm font-medium">{me?.profile?.full_name || me?.email}</p>
                <p className="truncate text-xs text-slate-300">
                  {me?.school?.name ?? "Platform Administration"}
                </p>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    void signOut();
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
