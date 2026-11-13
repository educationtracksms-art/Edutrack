import { Btn, Pill } from "../ui-kit";
import { type ReactNode } from "react";

/**
 * Navbar component with icons, each having a different background color.
 * Uses the Pill tone colors for distinct visual styling.
 */
export function Navbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <nav className={`flex flex-col sm:flex-row items-center gap-2 p-2 rounded-xl border border-border bg-card ${className}`}>
      {/* Home Icon */}
      <Pill tone="success">
        <Btn variant="ghost">
          <i className="lucide-home h-5 w-5" />
        </Btn>
      </Pill>

      {/* Assessments Icon */}
      <Pill tone="warning">
        <Btn variant="ghost">
          <i className="lucide-bar-chart h-5 w-5" />
        </Btn>
      </Pill>

      {/* Students Icon */}
      <Pill tone="muted">
        <Btn variant="ghost">
          <i className="lucide-users h-5 w-5" />
        </Btn>
      </Pill>

      {/* Finance Icon */}
      <Pill tone="danger">
        <Btn variant="ghost">
          <i className="lucide-dollar-sign h-5 w-5" />
        </Btn>
      </Pill>

      {/* Approvals Icon */}
      <Pill tone="success">
        <Btn variant="ghost">
          <i className="lucide-shield-check h-5 w-5" />
        </Btn>
      </Pill>
    </nav>
  );
}