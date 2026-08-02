const MISSING_ENV_PREFIX = "Missing Supabase environment variable(s):";
const ADMIN_UNAVAILABLE_MESSAGE =
  "Supabase admin client is unavailable because the committed .env file was not found at runtime.";

export function friendlyAdminError(error: Error): string {
  if (error.message.includes(MISSING_ENV_PREFIX)) {
    return "Admin features are unavailable because the committed .env file is not being shipped with the deployment.";
  }

  if (error.message === ADMIN_UNAVAILABLE_MESSAGE) {
    return "Admin features are unavailable because the committed .env file is not being shipped with the deployment.";
  }

  return error.message;
}
