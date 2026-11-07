const itemColors = [
  "bg-sky-100/80 text-sky-800 hover:bg-sky-200/80 dark:bg-sky-400/10 dark:text-sky-100 dark:hover:bg-sky-400/20",
  "bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200/80 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-400/20",
  "bg-amber-100/80 text-amber-900 hover:bg-amber-200/80 dark:bg-amber-400/10 dark:text-amber-100 dark:hover:bg-amber-400/20",
  "bg-rose-100/80 text-rose-800 hover:bg-rose-200/80 dark:bg-rose-400/10 dark:text-rose-100 dark:hover:bg-rose-400/20",
  "bg-violet-100/80 text-violet-800 hover:bg-violet-200/80 dark:bg-violet-400/10 dark:text-violet-100 dark:hover:bg-violet-400/20",
  "bg-cyan-100/80 text-cyan-800 hover:bg-cyan-200/80 dark:bg-cyan-400/10 dark:text-cyan-100 dark:hover:bg-cyan-400/20",
];

/**
 * Sidebar navigation item type
 */
export type SidebarItem = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  color?: string;
};

/**
 * Sidebar navigation with glossy water-drop details and individually colored items.
 */
export function SidebarNav({ items, className = "" }: { items: SidebarItem[]; className?: string }) {
  return (
    <nav
      aria-label="Sidebar navigation"
      className={`relative isolate flex flex-col gap-2 overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4 shadow-lg shadow-sky-950/10 dark:border-sky-900/60 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950 ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cyan-200/30 blur-2xl dark:bg-cyan-400/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-sky-200/40 blur-2xl dark:bg-sky-400/10"
      />
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          aria-label={item.label}
          onClick={item.onClick}
          className={`group relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl border border-white/70 px-3 py-2.5 text-left text-sm font-semibold shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-white/10 dark:focus-visible:ring-offset-slate-900 ${
            item.color ?? itemColors[index % itemColors.length]
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-3 -top-5 h-16 w-16 rounded-full bg-white/35 shadow-[inset_3px_3px_8px_rgba(255,255,255,0.65),inset_-4px_-5px_10px_rgba(15,23,42,0.12)] transition-transform duration-300 group-hover:scale-125 dark:bg-white/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-7 top-2 h-2 w-3 rotate-[-35deg] rounded-full bg-white/60 blur-[1px] dark:bg-white/20"
          />
          <i aria-hidden="true" className={`relative z-10 shrink-0 ${item.icon}`} />
          <span className="relative z-10">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
