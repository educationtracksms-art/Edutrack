import { type FormEvent, useState } from "react";

export type CheckoutRequest = {
  amount: number;
  phone: string;
  callback: string;
  ipnId: string;
};

export type CheckoutResult = {
  success: boolean;
  message?: unknown;
};

export type PesapalCheckoutProps = {
  amount: number;
  callback: string;
  ipnId: string;
  submitOrder: (request: CheckoutRequest) => Promise<CheckoutResult>;
};

function redirectFromResult(result: CheckoutResult): string | undefined {
  if (!result.message || typeof result.message !== "object") return undefined;
  const message = result.message as { redirect_url?: unknown };
  return typeof message.redirect_url === "string" ? message.redirect_url : undefined;
}

/**
 * Browser-safe checkout form. The submitOrder callback should call your own
 * authenticated server endpoint, which then uses the Pesapal service.
 */
export function PesapalCheckout({ amount, callback, ipnId, submitOrder }: PesapalCheckoutProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    try {
      const result = await submitOrder({ amount, phone, callback, ipnId });
      if (!result.success) {
        setError(typeof result.message === "string" ? result.message : "Payment could not start");
        return;
      }

      const redirectUrl = redirectFromResult(result);
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Payment could not start");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pesapal-checkout">
      <label>
        Phone number
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="2547XXXXXXXX"
          required
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Starting payment…" : `Pay ${amount}`}
      </button>
    </form>
  );
}
