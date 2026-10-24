import * as React from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  Banknote,
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  CircleHelp,
  FileBarChart,
  FileText,
  HandCoins,
  Landmark,
  FileBadge,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  MoveUpRight,
  Menu,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  ReceiptText,
  ScrollText,
  Search,
  Settings2,
  Users,
  Vault,
  Wallet,
  X,
} from "lucide-react";
import {
  BadgeCheck,
  BookOpen,
  CalendarPlus,
  FileCheck,
  CircleUser,
  ClipboardList,
  Coins,
  Gauge,
  Gift,
  Send,
  SlidersHorizontal,
  UserCog,
  UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";

import logoUrl from "@/assets/logo-optimized.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import {
  ACADEMIC_MANAGERS,
  ROLE_LABELS,
  SCHOOL_ROLES,
  clearCachedUser,
  hasAny,
  type AppRole,
  useCurrentUser,
} from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { getEnabledModuleMap } from "@/lib/modules";
import { stableDataQueryOptions, subscriptionQueryOptions } from "@/lib/query-cache-config";
import { takeAccessNotice } from "@/lib/access-notice";
import { SubscriptionExpiredBlock } from "@/components/subscription/SubscriptionExpiredBlock";
import { getSchoolSubscriptionStatus } from "@/lib/subscription.functions";
import { cn } from "@/lib/utils";
import { Suspense, lazy } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
const NotificationPanel = lazy(() =>
  import("@/components/notifications/NotificationPanel").then((m) => ({
    default: m.NotificationPanel,
  })),
);

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: AppRole[];
  module?: string;
  section?: string;
};

const ALL: AppRole[] = [
  "super_admin",
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "hod",
  "class_teacher",
  "subject_teacher",
];

/**
 * The Bursar sidebar is an allow-list: finance navigation renders for the Bursar
 * role only. See {@link FINANCE_ROUTE_ROLES} in "@/lib/route-guards" for the
 * matching route-level guard and the SQL policy helpers for the data layer.
 */
const FINANCE_ROLES: AppRole[] = ["bursar"];

/** Every role that works inside a school, used for the non-finance Bursar tools. */
const SCHOOL_OPERATIONS_ROLES: AppRole[] = [
  "school_admin",
  "head_teacher",
  "deputy_head_teacher",
  "dos",
  "hod",
  "class_teacher",
  "subject_teacher",
  "librarian",
];

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL, section: "Home" },
  {
    to: "/schools",
    label: "Schools",
    icon: Building2,
    roles: ["super_admin"],
    section: "Administration",
  },
  {
    to: "/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
    roles: ["super_admin"],
    section: "Administration",
  },
  {
    to: "/subscription",
    label: "Subscription",
    icon: Coins,
    roles: ["school_admin"],
    section: "Administration",
  },
  {
    to: "/students",
    label: "Learners",
    icon: GraduationCap,
    roles: SCHOOL_ROLES,
    section: "Setup",
  },
  {
    to: "/finance",
    label: "Bursar dashboard",
    icon: Gauge,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-receivables",
    label: "Receivables & arrears",
    icon: HandCoins,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-invoices",
    label: "Invoices & receipts",
    icon: ReceiptText,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-payments",
    label: "Payments",
    icon: Banknote,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-fees",
    label: "Fees & billing",
    icon: BadgeDollarSign,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-expenses",
    label: "Expenses & payables",
    icon: Wallet,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-procurement",
    label: "Procurement",
    icon: BookOpenCheck,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-banking",
    label: "Banking & cash",
    icon: Landmark,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-accounting",
    label: "Accounting & journals",
    icon: ArrowLeftRight,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-budgets",
    label: "Budgets",
    icon: PiggyBank,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-payroll",
    label: "Payroll",
    icon: Users,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-payroll-staff",
    label: "Payroll staff",
    icon: UserCog,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-hod-requests",
    label: "HOD requests",
    icon: ClipboardList,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-assets",
    label: "Assets & inventory",
    icon: Vault,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-grants",
    label: "Grants & aid",
    icon: Gift,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-reports",
    label: "Finance reports",
    icon: FileBarChart,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-approvals",
    label: "Approvals",
    icon: FileText,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/finance-settings",
    label: "Finance settings",
    icon: Settings2,
    roles: FINANCE_ROLES,
    module: "finance",
    section: "Bursar",
  },
  {
    to: "/academics",
    label: "School setup",
    icon: Library,
    roles: ACADEMIC_MANAGERS,
    module: "academics",
    section: "Setup",
  },
  {
    to: "/library",
    label: "Library",
    icon: BookOpen,
    roles: ["head_teacher", "deputy_head_teacher", "dos", "librarian"],
    module: "library",
    section: "Operations",
  },
  {
    to: "/timetable",
    label: "Timetable",
    icon: CalendarClock,
    roles: SCHOOL_ROLES,
    module: "timetable",
    section: "Teaching & results",
  },
  {
    to: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    roles: SCHOOL_ROLES,
    section: "Operations",
  },
  {
    to: "/events",
    label: "Events",
    icon: CalendarPlus,
    roles: SCHOOL_ROLES,
    section: "Operations",
  },
  {
    to: "/assessments",
    label: "Enter marks",
    icon: ClipboardCheck,
    // School administrators keep oversight of marks through Reports and the
    // marks approval screens; this workspace belongs to the people who actually
    // capture marks (DOS, HOD and teachers). The route itself is unchanged, so
    // administrators can still be added back here without touching the page.
    roles: [
      "dos",
      "hod",
      "head_teacher",
      "deputy_head_teacher",
      "subject_teacher",
      "class_teacher",
    ],
    module: "academics",
    section: "Teaching & results",
  },
  {
    to: "/finance-requests",
    label: "Finance requests",
    icon: Send,
    roles: ["hod"],
    section: "Requests",
  },
  {
    to: "/approval",
    label: "Marks approvals",
    icon: BadgeCheck,
    roles: ["dos"],
    module: "academics",
    section: "Teaching & results",
  },
  {
    to: "/approved",
    label: "Approved results",
    icon: FileCheck,
    roles: ["dos"],
    module: "academics",
    section: "Teaching & results",
  },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarCheck,
    roles: ["class_teacher", "hod", "dos", "school_admin", "head_teacher", "deputy_head_teacher"],
    module: "attendance",
    section: "Teaching & results",
  },
  {
    to: "/reports",
    label: "Reports",
    icon: FileBadge,
    roles: ["school_admin", "head_teacher", "deputy_head_teacher", "dos"],
    section: "Teaching & results",
  },
  {
    to: "/marksheet",
    label: "Marks overview",
    icon: NotebookText,
    roles: ["head_teacher", "deputy_head_teacher", "dos", "hod", "class_teacher", "subject_teacher"],
    module: "academics",
    section: "Teaching & results",
  },
  {
    to: "/promotions",
    label: "Promote learners",
    icon: MoveUpRight,
    roles: ACADEMIC_MANAGERS,
    module: "students",
    section: "Teaching & results",
  },
  {
    to: "/users",
    label: "Staff & roles",
    icon: UsersRound,
    roles: ["super_admin", "school_admin"],
    section: "Setup",
  },
  {
    to: "/account-settings",
    label: "My settings",
    icon: CircleUser,
    // Personal account details (name, password) stay available to every role;
    // school-wide configuration is disabled for the Bursar below.
    roles: ["super_admin", ...SCHOOL_ROLES, "bursar"],
    section: "Administration",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: SlidersHorizontal,
    roles: SCHOOL_ROLES,
    section: "Administration",
  },
  {
    to: "/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    roles: ["school_admin", "head_teacher"],
    section: "Administration",
  },
];

const NAV_SECTION_ORDER = [
  "Home",
  "Bursar",
  "Setup",
  "Teaching & results",
  "Requests",
  "Operations",
  "Administration",
];

const SIDEBAR_PREFERENCE_KEY = "edutrack-sidebar-expanded";

function readSidebarPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useSessionTimeout();
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();
  // Module metadata is stable (Tier 1): 30 min stale, 60 min GC
  const { data: moduleMap } = useQuery({
    ...stableDataQueryOptions(["enabled-modules", me?.profile?.school_id ?? null]),
    enabled: !!me?.profile?.school_id,
    queryFn: async () => getEnabledModuleMap(supabase, me?.profile?.school_id ?? null),
  });

  // Subscription status (Tier 4): 5 min stale (reduced from 60s for efficiency).
  // A school-scoped, non-admin user whose subscription has expired sees only the blocking screen.
  const isSuperAdmin = !!me?.roles?.includes("super_admin");
  const isSchoolScopedUser = !!me?.profile?.school_id && !isSuperAdmin;
  const { data: subscriptionState } = useQuery({
    ...subscriptionQueryOptions(["shell-subscription-status", me?.profile?.school_id ?? null]),
    enabled: isSchoolScopedUser,
    queryFn: () => getSchoolSubscriptionStatus(),
  });
  const [labelsVisible, setLabelsVisible] = React.useState(readSidebarPreference);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const preloadPage = React.useCallback((to: string) => void router.preloadRoute({ to }), [router]);

  // A route guard that turned the user away parks one message for us to show,
  // so a blocked deep link explains itself instead of silently bouncing.
  React.useEffect(() => {
    const notice = takeAccessNotice();
    if (notice) toast.error(notice);
  }, [pathname]);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  React.useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  React.useEffect(() => {
    if (!isMobile) return;

    // Defer table decoration until the browser is idle: it walks the DOM and
    // must never compete with first paint / first interaction.
    let observer: MutationObserver | null = null;
    let frame: number | null = null;
    let idleId: number | null = null;
    let cancelled = false;
    const decorateTables = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const root = document.querySelector("main");
        if (!root) return;
        root.querySelectorAll("table.w-full").forEach((table) => {
          table.setAttribute("data-responsive-table", "true");

          const headers = Array.from(table.querySelectorAll("thead th"));
          const headerLabels = headers.map((header, index) => {
            const label = header.textContent?.trim();
            if (label) return label;
            return index === headers.length - 1 ? "Action" : `Column ${index + 1}`;
          });

          table.querySelectorAll("tbody tr").forEach((row) => {
            row.querySelectorAll("td").forEach((cell, index) => {
              const label = headerLabels[index] ?? `Column ${index + 1}`;
              if (cell.getAttribute("data-label") !== label) {
                cell.setAttribute("data-label", label);
              }
            });
          });
        });
      });
    };

    const start = () => {
      if (cancelled) return;
      decorateTables();
      const root = document.querySelector("main");
      if (!root) return;
      observer = new MutationObserver(decorateTables);
      observer.observe(root, { childList: true, subtree: true });
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(start, { timeout: 1500 });
    } else {
      idleId = window.setTimeout(start, 300);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (idleId !== null) {
        if (typeof window.cancelIdleCallback === "function") {
          try {
            window.cancelIdleCallback(idleId);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_ignored) {
            window.clearTimeout(idleId);
          }
        } else {
          window.clearTimeout(idleId);
        }
      }
    };
  }, [isMobile, pathname]);

  const items = NAV.filter((item) => hasAny(me?.roles, item.roles))
    .filter((item) => (item.module ? (moduleMap?.get(item.module) ?? true) : true))
    .sort(
      (a, b) =>
        (NAV_SECTION_ORDER.indexOf(a.section ?? "") + 1 || 999) -
          (NAV_SECTION_ORDER.indexOf(b.section ?? "") + 1 || 999) ||
        NAV.indexOf(a) - NAV.indexOf(b),
    );
  const searchResults = items.filter((item) =>
    item.label.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );
  const primaryRole = me?.roles?.[0];
  const sidebarWidth = labelsVisible ? "w-64" : "w-[4.5rem]";
  const contentOffset = labelsVisible ? "pl-64" : "pl-[4.5rem]";
  function toggleSidebar() {
    setLabelsVisible((expanded) => {
      const next = !expanded;
      try {
        window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(next));
      } catch {
        // Sidebar preference is optional when storage is unavailable.
      }
      return next;
    });
  }
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
    clearCachedUser();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Non-admin school users whose subscription has expired get the full-screen,
  // non-dismissible blocking message instead of any dashboard content.
  const isSchoolAdmin = !!me?.roles?.includes("school_admin");
  if (
    isSchoolScopedUser &&
    !isSchoolAdmin &&
    subscriptionState?.status === "expired"
  ) {
    const schoolName = me?.school?.name ?? "your school";
    const userName = (me?.profile as { full_name?: string } | null)?.full_name ?? me?.email ?? "there";
    return (
      <SubscriptionExpiredBlock
        userName={userName}
        schoolName={schoolName}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && (
        <aside
          aria-label="Main sidebar"
          className={cn(
            "no-print fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r border-slate-200/80 bg-white text-slate-700 shadow-[0_12px_36px_-22px_rgba(15,23,42,0.28)] transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            sidebarWidth,
          )}
        >
          <div
            className={cn(
              "flex min-h-[4.5rem] items-center gap-3 border-b border-slate-100 px-3 py-3",
              !labelsVisible && "flex-col justify-center gap-2 px-2",
            )}
          >
            <img
              src={me?.school?.logo_url || logoUrl}
              alt={`${me?.school?.name || "EduTrack"} logo`}
              className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 object-cover ring-1 ring-slate-200/80 transition-transform duration-300 hover:scale-[1.03]"
            />
            <div className={cn("min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200", labelsVisible ? "max-w-48 opacity-100" : "max-w-0 flex-none opacity-0")}>
                <p className="truncate text-sm font-semibold leading-tight tracking-tight text-slate-900">
                  {me?.school?.name || "EduTrack"}
                </p>
                <p className="truncate text-[11px] text-slate-500">School Management</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-lg text-slate-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm active:scale-95"
              onClick={toggleSidebar}
              aria-label={labelsVisible ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={labelsVisible}
              aria-controls="desktop-navigation"
              title={labelsVisible ? "Collapse sidebar" : "Expand sidebar"}
            >
              {labelsVisible ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </div>

          <nav id="desktop-navigation" aria-label="School tools" className="flex-1 space-y-1 overflow-y-auto p-3">
            {items.map((item, index) => {
              // Match the route itself or a child path, so /finance-payroll no
              // longer also highlights the /finance dashboard entry.
              const active =
                pathname === item.to || pathname.startsWith(`${item.to}/`);
              const showSection = item.section && item.section !== items[index - 1]?.section;
              return (
                <React.Fragment key={item.to}>
                  {showSection && labelsVisible && (
                    <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 first:pt-0">
                      {item.section}
                    </p>
                  )}
                  <Link
                    to={item.to}
                    preload="intent"
                    onPointerDown={() => preloadPage(item.to)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ease-out hover:translate-x-0.5 motion-reduce:transform-none",
                      active
                        ? "bg-blue-50 font-semibold text-blue-700 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.10)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-blue-600"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                      !labelsVisible && "justify-center gap-0 px-2",
                    )}
                    title={!labelsVisible ? item.label : undefined}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-700")} />
                    <span className={cn("min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,transform,opacity] duration-200", labelsVisible ? "max-w-48 translate-x-0 opacity-100" : "max-w-0 -translate-x-1 opacity-0")}>{item.label}</span>
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-2">
            <Link
              to="/help"
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-slate-600 transition-all duration-200 hover:translate-x-0.5 hover:bg-slate-50 hover:text-slate-950",
                pathname === "/help" && "bg-blue-50 font-semibold text-blue-700",
                !labelsVisible && "justify-center gap-0 px-2",
              )}
              title={!labelsVisible ? "Help & user guide" : undefined}
            >
              <CircleHelp className="h-[18px] w-[18px] shrink-0 text-slate-400 transition-colors group-hover:text-blue-600" />
              <span className={cn("min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,transform,opacity] duration-200", labelsVisible ? "max-w-48 translate-x-0 opacity-100" : "max-w-0 -translate-x-1 opacity-0")}>Help & user guide</span>
            </Link>
          </div>

          <div className="border-t border-slate-100 px-2 py-2">
            <div className={cn(!labelsVisible && "flex justify-center")}>
              <Suspense fallback={null}>
                <NotificationPanel showLabel={labelsVisible} />
              </Suspense>
            </div>
          </div>

          <div className="border-t border-slate-100 p-3 text-xs">
            {labelsVisible ? (
              <>
                <p className="truncate font-medium text-slate-800">{me?.profile?.full_name || me?.email}</p>
                <p className="text-slate-400">Signed in</p>
              </>
            ) : (
              <div className="flex items-center justify-center">
                <div
                  className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50"
                  title={me?.email ?? "Account"}
                />
              </div>
            )}
            <button
              onClick={signOut}
              className={cn(
                "mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-slate-500 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98]",
                !labelsVisible && "justify-center gap-0 px-2",
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
            className="w-[88vw] max-w-sm border-slate-200 bg-white p-0 text-slate-700"
          >
            <SheetHeader className="border-b border-slate-100 px-4 py-5 text-left">
              <SheetTitle className="flex items-center gap-3 text-base text-slate-900">
                <img
                  src={me?.school?.logo_url || logoUrl}
                  alt={`${me?.school?.name || "EduTrack"} logo`}
                  className="h-10 w-10 rounded-xl bg-slate-50 object-cover ring-1 ring-slate-200/80"
                />
                <span className="truncate">{me?.school?.name || "EduTrack"}</span>
              </SheetTitle>
              <SheetDescription className="text-slate-500">
                Jump between school tools and account actions.
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col">
              <nav id="mobile-navigation" aria-label="School tools" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                {items.map((item, index) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <React.Fragment key={item.to}>
                      {item.section && item.section !== items[index - 1]?.section && (
                        <p className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 first:pt-0">
                          {item.section}
                        </p>
                      )}
                      <Link
                        to={item.to}
                        preload="intent"
                        onPointerDown={() => preloadPage(item.to)}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-200 ease-out hover:translate-x-0.5",
                          active
                            ? "bg-blue-50 font-semibold text-blue-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                        )}
                      >
                        <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-700")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </React.Fragment>
                  );
                })}
              </nav>

              <div className="border-t border-slate-100 p-3">
                <Link
                  to="/help"
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-600 transition-all duration-200 hover:translate-x-0.5 hover:bg-slate-50 hover:text-slate-950",
                    pathname === "/help" && "bg-blue-50 font-semibold text-blue-700",
                  )}
                >
                  <CircleHelp className="h-[18px] w-[18px] shrink-0 text-slate-400 transition-colors group-hover:text-blue-600" />
                  <span>Help & user guide</span>
                </Link>
              </div>

              <div className="border-t border-slate-100 px-3 py-2">
                <Suspense fallback={null}>
                  <NotificationPanel />
                </Suspense>
              </div>

              <div className="border-t border-slate-100 p-3">
                <p className="truncate text-sm font-medium text-slate-800">
                  {me?.profile?.full_name || me?.email}
                </p>
                <p className="text-xs text-slate-400">
                  {primaryRole ? ROLE_LABELS[primaryRole] : "No role"}
                </p>
                <button
                  onClick={signOut}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98]"
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
          !isMobile && "transition-[padding-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          !isMobile && contentOffset,
        )}
      >
        <header className="no-print sticky top-0 z-30 border-b border-border bg-background backdrop-blur">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-3 sm:flex-nowrap sm:px-4 md:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {isMobile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation menu"
                  aria-expanded={mobileNavOpen}
                  aria-controls="mobile-navigation"
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
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 px-3 text-muted-foreground"
                  onClick={() => setSearchOpen((value) => !value)}
                  aria-label="Search system"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
                    Ctrl K
                  </kbd>
                </Button>
                {searchOpen && (
                  <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-2 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        ref={searchInputRef}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search school tools..."
                        className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                        aria-label="Search school tools"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm("");
                          setSearchOpen(false);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                        aria-label="Close search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto pt-1">
                      {searchResults.length ? (
                        searchResults.map((item) => (
                          <button
                            key={item.to}
                            type="button"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              navigate({ to: item.to });
                              setSearchOpen(false);
                              setSearchTerm("");
                            }}
                            onMouseEnter={() => router.preloadRoute({ to: item.to })}
                            onFocus={() => router.preloadRoute({ to: item.to })}
                            onPointerDown={() => preloadPage(item.to)}
                          >
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            <span>{item.label}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-4 text-sm text-muted-foreground">No tools found.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Suspense fallback={null}>
                <NotificationPanel showLabel={false} />
              </Suspense>
              <div className="hidden items-center gap-2 md:flex">
                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {primaryRole ? ROLE_LABELS[primaryRole] : "No role"}
                </span>
              </div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-7">
          <div className="mx-auto w-full max-w-[1800px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
