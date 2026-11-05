const expirableSubscriptionStatuses = new Set([
  "trial",
  "active",
  "past_due",
  "pending",
  "confirmed",
]);

const accessGrantedSubscriptionStatuses = new Set(["trial", "active", "confirmed"]);

export function isSubscriptionAccessGranted(status: string): boolean {
  return accessGrantedSubscriptionStatuses.has(status);
}

type SubscriptionRecord = {
  status: string;
  starts_at: string;
  ends_at: string | null;
};

export function resolveSchoolSubscription<T extends SubscriptionRecord>(
  subscriptions: T[],
  now = new Date(),
): { status: string; subscription: T | null } {
  if (subscriptions.length === 0) {
    return { status: "not_configured", subscription: null };
  }

  const today = now.toISOString().slice(0, 10);
  const currentAccessSubscription = subscriptions.find(
    (subscription) =>
      isSubscriptionAccessGranted(subscription.status) &&
      subscription.starts_at <= today &&
      !isSubscriptionExpired(subscription.status, subscription.ends_at, now),
  );
  if (currentAccessSubscription) {
    return {
      status: currentAccessSubscription.status,
      subscription: currentAccessSubscription,
    };
  }

  const latestSubscription = subscriptions[0];
  if (isSubscriptionAccessGranted(latestSubscription.status)) {
    return {
      status:
        latestSubscription.starts_at > today
          ? "not_started"
          : "expired",
      subscription: latestSubscription,
    };
  }

  return {
    status: isSubscriptionExpired(
      latestSubscription.status,
      latestSubscription.ends_at,
      now,
    )
      ? "expired"
      : latestSubscription.status,
    subscription: latestSubscription,
  };
}

export function isSubscriptionExpired(
  status: string,
  endsAt: string | null,
  now = new Date(),
): boolean {
  if (!endsAt || !expirableSubscriptionStatuses.has(status)) return false;

  const today = now.toISOString().slice(0, 10);
  return endsAt < today;
}
