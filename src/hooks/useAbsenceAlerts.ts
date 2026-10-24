import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { listAbsenceAlerts, triggerAbsenceAlerts } from "@/lib/attendance.functions";
export function useAbsenceAlerts(limit = 50) {
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  return useQuery({
    queryKey: ["absence-alerts", schoolId, limit],
    enabled: !!schoolId,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => listAbsenceAlerts({ data: { limit } }),
  });
}
export function useTriggerAbsenceAlerts() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const schoolId = me?.profile?.school_id ?? null;
  return useMutation({
    mutationFn: async (date?: string | null) => triggerAbsenceAlerts({ data: { date: date ?? null } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["absence-alerts", schoolId] }),
  });
}
