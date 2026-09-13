import { Pesapal } from "../src/Pesapal";

/** Call this from the server route used by the Pesapal callback. */
export function verifyPayment(orderTrackingId: string) {
  return Pesapal.transactionStatus(orderTrackingId);
}
