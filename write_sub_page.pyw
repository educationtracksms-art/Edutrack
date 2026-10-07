import pathlib

path = pathlib.Path("D:/Edutrack/src/routes/_authenticated/subscription.tsx")
content = path.read_text()

# Check if already has the component
if "function SubscriptionPage()" in content:
    print("Already has component")
else:
    component = """\n\nfunction SubscriptionPage() {
  const { data: me, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const schoolId = (me?.profile as { school_id?: string } | null)?.school_id ?? null;
  const canView = hasAny(me?.roles, ["school_admin", "head_teacher", "dos"]);
  const isSchoolAdmin = me?.roles.includes("school_admin");
  const isLoading = userLoading || !me;

  const { data: expiredCheck } = useQuery({
    queryKey: ["subscription-expired-check", schoolId],
    enabled: !!schoolId && canView && !isSchoolAdmin,
    staleTime: 60_000,
    queryFn: async () => (await isSubscriptionExpired({ queryClient })) as boolean,
  });

  const showBlockingScreen = !isSchoolAdmin && expiredCheck === true;

  const { data: currentSub } = useQuery({
    queryKey: ["active-subscription", schoolId],
    enabled: !!schoolId && canView,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subscriptions")
        .select(`id, status, starts_at, ends_at, payment_reference,\n          subscription_plans (id, name, price, duration_value, duration_unit, duration_days, description, is_active, is_platform_only)`)
        .eq("school_id", schoolId!)
        .in("status", ["trial", "active", "past_due", "pending", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as ActiveSubscription | null;
    },
  });
"""
    path.write_text(content + component)
    print("Wrote partial component")

