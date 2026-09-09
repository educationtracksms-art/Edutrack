import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function NotificationPanel({
  page = false,
  showLabel = true,
}: {
  page?: boolean;
  showLabel?: boolean;
}) {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [nextClassEnabled, setNextClassEnabled] = useState(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem("edutrack-next-class-notifications") === "true",
  );
  const queryKey = ["notifications", me?.userId];
  const { data: notifications = [] } = useQuery({
    queryKey,
    enabled: !!me?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at")
        .eq("user_id", me!.userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  const unread = notifications.filter((item) => !item.is_read).length;
  const updateNotification = useMutation({
    mutationFn: async ({ id, is_read }: { id: string; is_read: boolean }) => {
      const { error } = await supabase.from("notifications").update({ is_read }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  async function toggleNextClassNotifications(enabled: boolean) {
    setNextClassEnabled(enabled);
    window.localStorage.setItem("edutrack-next-class-notifications", String(enabled));
    if (!enabled || !me?.userId || !me.profile?.school_id) return;
    const { data: nextClass } = await supabase
      .from("timetable_entries")
      .select("day_of_week, period, start_time, end_time, classroom")
      .eq("school_id", me.profile.school_id)
      .eq("teacher_id", me.userId)
      .order("day_of_week")
      .order("period")
      .limit(1)
      .maybeSingle();
    if (nextClass) {
      await supabase.from("notifications").insert({
        school_id: me.profile.school_id,
        user_id: me.userId,
        title: "Next class reminder",
        body: `Your next class is on ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][nextClass.day_of_week - 1]} at ${nextClass.start_time}${nextClass.classroom ? ` in ${nextClass.classroom}` : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => (page ? setOpen(true) : navigate({ to: "/notifications" }))}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {showLabel && <span>Notifications</span>}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {(open || page) && (
        <div className={page ? "w-full rounded-2xl border border-border bg-card p-4 shadow-sm" : "absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 shadow-xl"}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Notifications</h2>
            <span className="text-xs text-muted-foreground">{unread} unread</span>
          </div>
          <label className="mb-3 flex items-center justify-between rounded-xl bg-muted/50 p-3 text-sm">
            <span>Notify me about my next class</span>
            <input
              type="checkbox"
              checked={nextClassEnabled}
              onChange={(event) => toggleNextClassNotifications(event.target.checked)}
            />
          </label>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">No notifications.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-3 ${notification.is_read ? "border-border" : "border-primary/40 bg-primary/5"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{notification.title}</p>
                      {notification.body && <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!notification.is_read && (
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Mark as read"
                          onClick={() => updateNotification.mutate({ id: notification.id, is_read: true })}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete notification"
                        onClick={() => deleteNotification.mutate(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
