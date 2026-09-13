# Pesapal Cookout for TypeScript/TSX

This package is a TypeScript/TSX translation of the original Pesapal PHP
integration. It provides:

- a server-side `Pesapal` API client;
- a small `Curl`/`fetch` response wrapper;
- a browser-safe `PesapalCheckout` form component.

## Configuration

Keep Pesapal credentials on the server. Configure them with environment
variables or by calling `Pesapal.configure` from server code:

```text
PESAPAL_CONSUMER_KEY=your-consumer-key
PESAPAL_CONSUMER_SECRET=your-consumer-secret
PESAPAL_BUSINESS_CURRENCY=KES
PESAPAL_BASE_URL=https://cybqa.pesapal.com/pesapalv3
PESAPAL_CALLBACK_BASE_URL=https://your-public-domain.example
PESAPAL_IPN_ID=your-registered-ipn-id
```

Use `https://pay.pesapal.com/v3` for production. The callback base URL must be
publicly reachable; the callback path `/pesapal/callback` is added by the IPN
registration helper.

## Server usage

```tsx
import { Pesapal } from "./src/Pesapal";

const result = await Pesapal.orderProcess(
  2,
  "2547XXXXXXXX",
  "https://example.com/pesapal/callback",
  "your-registered-ipn-id",
);
```

Use `Pesapal.pesapalAuth()`, `Pesapal.pesapalRegisterIPN()`,
`Pesapal.listIPNS()`, and `Pesapal.transactionStatus()` for the other API
operations.

## React usage

`PesapalCheckout` does not contain credentials. Pass it an authenticated
`submitOrder` callback that calls your server endpoint:

```tsx
<PesapalCheckout
  amount={2}
  callback="https://example.com/pesapal/callback"
  ipnId="your-registered-ipn-id"
  submitOrder={(request) => api.createPesapalOrder(request)}
/>
```

The original PHP and Composer files have been replaced by `.tsx` modules and
the local `tsconfig.json`/`package.json` setup.
