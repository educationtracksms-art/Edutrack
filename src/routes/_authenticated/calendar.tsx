import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({ beforeLoad: async () => { if (!(await supabase.auth.getUser()).data.user) throw redirect({ to: "/auth" }); }, component: CalendarPage });
function CalendarPage() {
  const { data: me } = useCurrentUser(); const [month, setMonth] = useState(new Date());
  const { data: events = [], isLoading } = useQuery({ queryKey: ["school-events", me?.profile?.school_id], enabled: !!me?.profile?.school_id, queryFn: async () => { const { data, error } = await supabase.from("school_events").select("*").order("start_date"); if (error) throw error; return data ?? []; } });
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  const byDay = useMemo(() => new Map(days.map((day) => [format(day, "yyyy-MM-dd"), events.filter((event) => isSameDay(new Date(`${event.start_date}T00:00:00`), day))])), [days, events]);
  if (me && !me.profile?.school_id) {
    return <p className="text-sm text-muted-foreground">School activities are managed by school administrators.</p>;
  }
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Calendar</h1><p className="text-sm text-muted-foreground">Keep the whole school community aligned.</p></div><Button asChild><Link to="/events"><Plus className="mr-2 h-4 w-4" />Manage events</Link></Button></div><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{format(month, "MMMM yyyy")}</CardTitle><div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" onClick={() => setMonth(new Date())}>Today</Button><Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button></div></CardHeader><CardContent><div className="grid grid-cols-7 border-l border-t">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div key={day} className="border-b border-r bg-muted/40 p-2 text-center text-xs font-semibold">{day}</div>)}{days.map((day) => <div key={day.toISOString()} className={cn("min-h-28 border-b border-r p-2", !isSameMonth(day, month) && "bg-muted/20 text-muted-foreground")}><div className={cn("mb-1 text-sm", isSameDay(day, new Date()) && "flex h-6 w-6 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground")}>{format(day,"d")}</div>{(byDay.get(format(day,"yyyy-MM-dd")) ?? []).map((event) => <Link key={event.id} to="/events" className="mb-1 block truncate rounded bg-primary/10 px-1.5 py-1 text-xs font-medium text-primary hover:bg-primary/20">{event.title}</Link>)}</div>)}</div>{isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading events…</p>}</CardContent></Card></div>;
}
