import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  FileBadge,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  MoveUpRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings2,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import logoUrl from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ACADEMIC_MANAGERS,
  ROLE_LABELS,
  SCHOOL_ROLES,
  hasAny,
  type AppRole,
  useCurrentUser,
} from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: AppRole[];
};

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
    roles: ["super_admin", ...SCHOOL_ROLES],
  },
  { to: "/academics", label: "Academic setup", icon: Library, roles: ACADEMIC_MANAGERS },
  {
    to: "/library",
    label: "Library",
    icon: Library,
    roles: [
      "super_admin",
      "school_admin",
      "head_teacher",
      "deputy_head_teacher",
      "dos",
      "librarian",
    ],
  },
  { to: "/timetable", label: "Timetable", icon: CalendarClock, roles: SCHOOL_ROLES },
  {
    to: "/assessments",
    label: "Assessments",
    icon: ClipboardCheck,
    roles: [
      "dos",
      "school_admin",
      "head_teacher",
      "deputy_head_teacher",
      "subject_teacher",
      "class_teacher",
    ],
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
  const isMobile = useIsMobile();
  const [labelsVisible, setLabelsVisible] = React.useState(() => !isMobile);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    setLabelsVisible(!isMobile);
  }, [isMobile]);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!isMobile) return;

    const root = document.querySelector("main");
    if (!root) return;

    const decorateTables = () => {
      root.querySelectorAll("table.w-full.text-sm").forEach((table) => {
        table.setAttribute("data-responsive-table", "true");

        const headerLabels = Array.from(table.querySelectorAll("thead th")).map((header, index) => {
          const label = header.textContent?.trim();
          if (label) return label;
          return index === table.querySelectorAll("thead th").length - 1
            ? "Action"
            : `Column ${index + 1}`;
        });

        table.querySelectorAll("tbody tr").forEach((row) => {
          row.querySelectorAll("td").forEach((cell, index) => {
            const label = headerLabels[index] ?? `Column ${index + 1}`;
            cell.setAttribute("data-label", label);
          });
        });
      });
    };

    decorateTables();

    const observer = new MutationObserver(decorateTables);
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isMobile, pathname]);

  const items = NAV.filter((item) => hasAny(me?.roles, item.roles));
  const primaryRole = me?.roles?.[0];
  const sidebarWidth = labelsVisible ? "w-72" : "w-20";
  const contentOffset = labelsVisible ? "pl-72" : "pl-20";
  const toggleLabel = labelsVisible ? "Hide words" : "Show words";
  const pageTitle =
    pathname === "/"
      ? "Dashboard"
      : pathname
          .slice(1)
          .replaceAll("-", " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {!isMobile && (
        <aside
          className={cn(
            "no-print fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-[width] duration-150",
            sidebarWidth,
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 border-b border-sidebar-border px-3 py-4",
              !labelsVisible && "justify-center",
            )}
          >
            <img
              src={me?.school?.logo_url || logoUrl}
              alt={`${me?.school?.name || "EduTrack"} logo`}
              className="h-11 w-11 rounded-full bg-white object-cover"
            />
            {labelsVisible && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {me?.school?.name || "EduTrack"}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">School Management</p>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => setLabelsVisible((value) => !value)}
              aria-label={labelsVisible ? "Hide sidebar words" : "Show sidebar words"}
              title={toggleLabel}
            >
              {labelsVisible ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {items.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    !labelsVisible && "justify-center px-2",
                  )}
                  title={!labelsVisible ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {labelsVisible && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3 text-xs">
            {labelsVisible ? (
              <>
                <p className="truncate font-medium">{me?.profile?.full_name || me?.email}</p>
                <p className="text-sidebar-foreground/60">Signed in</p>
              </>
            ) : (
              <div className="flex items-center justify-center">
                <div
                  className="h-2 w-2 rounded-full bg-sidebar-foreground/40"
                  title={me?.email ?? "Account"}
                />
              </div>
            )}
            <button
              onClick={signOut}
              className={cn(
                "mt-3 flex w-full items-center gap-2 rounded-xl bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground transition-colors hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                !labelsVisible && "justify-center px-2",
              )}
              title={!labelsVisible ? "Sign out" : undefined}
            >
              <LogOut className="h-3.5 w-3.5" />
              {labelsVisible && <span>Sign out</span>}
            </button>
          </div>
        </aside>
      )}

      {isMobile && (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-sm bg-sidebar p-0 text-sidebar-foreground"
          >
            <SheetHeader className="border-b border-sidebar-border px-4 py-5 text-left">
              <SheetTitle className="flex items-center gap-3 text-base text-sidebar-foreground">
                <img
                  src={me?.school?.logo_url || logoUrl}
                  alt={`${me?.school?.name || "EduTrack"} logo`}
                  className="h-11 w-11 rounded-full bg-white object-cover"
                />
                <span className="truncate">{me?.school?.name || "EduTrack"}</span>
              </SheetTitle>
              <SheetDescription className="text-sidebar-foreground/60">
                Jump between school tools and account actions.
              </SheetDescription>
            </SheetHeader>

            <div className="flex h-[calc(100%-5.75rem)] flex-col">
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {items.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      preload="intent"
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-sidebar-border p-3">
                <p className="truncate text-sm font-medium">
                  {me?.profile?.full_name || me?.email}
                </p>
                <p className="text-xs text-sidebar-foreground/60">
                  {primaryRole ? ROLE_LABELS[primaryRole] : "No role"}
                </p>
                <button
                  onClick={signOut}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-sidebar-accent px-4 py-3 text-sm font-medium text-sidebar-accent-foreground transition-colors hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col",
          !isMobile && "transition-[padding-left] duration-150",
          !isMobile && contentOffset,
        )}
      >
        <header className="no-print sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {isMobile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold sm:text-base">
                  {me?.school?.name ?? "Platform Administration"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{pageTitle}</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {primaryRole ? ROLE_LABELS[primaryRole] : "No role"}
              </span>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
