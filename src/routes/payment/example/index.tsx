import { Pesapal } from "../src/Pesapal";

export type CreatePaymentInput = {
  amount: number;
  phone: string;
  callback: string;
  ipnId: string;
};

/** Call this from a server route or authenticated server function. */
export function createPayment(input: CreatePaymentInput) {
  return Pesapal.orderProcess(input.amount, input.phone, input.callback, input.ipnId);
}
