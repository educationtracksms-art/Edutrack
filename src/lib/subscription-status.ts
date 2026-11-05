const expirableSubscriptionStatuses = new Set([
  "trial",
  "active",
  "past_due",
  "pending",
  "confirmed",
]);

export function isSubscriptionExpired(
  status: string,
  endsAt: string | null,
  now = new Date(),
): boolean {
  if (!endsAt || !expirableSubscriptionStatuses.has(status)) return false;

  const today = now.toISOString().slice(0, 10);
  return endsAt < today;
}
