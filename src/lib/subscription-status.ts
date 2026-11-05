const expirableSubscriptionStatuses = new Set([
  "trial",
  "active",
  "past_due",
  "pending",
  "confirmed",
]);

const accessGrantedSubscriptionStatuses = new Set(["trial", "active"]);

export function isSubscriptionAccessGranted(status: string): boolean {
  return accessGrantedSubscriptionStatuses.has(status);
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
