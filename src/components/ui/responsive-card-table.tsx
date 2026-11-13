import { type ReactNode } from "react";

/**
 * Responsive table that shows data as a real table on desktop
 * and as cards (label/value pairs) on mobile (< 768px).
 *
 * Expects the table to fit within viewport width. The `mobile` prop
 * should be an array of card elements, one per data row.
 */
export function ResponsiveCardTable({
  desktop,
  mobile,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  return (
    <>
      <div className="hidden md:block">{desktop}</div>
      <div className="space-y-3 md:hidden">{mobile}</div>
    </>
  );
}
