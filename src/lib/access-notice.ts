/**
 * A one-shot notice shown after a guard redirects a user away from a section
 * they cannot open. Route guards run before React renders, so the message is
 * parked in session storage and picked up once by the app shell.
 */
const NOTICE_KEY = "edutrack:access-notice";

export const NO_ACCESS_MESSAGE = "You do not have access to that section.";

export function setAccessNotice(message: string = NO_ACCESS_MESSAGE) {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    // Private browsing or server rendering: the redirect still happens.
  }
}

export function takeAccessNotice(): string | null {
  try {
    const message = sessionStorage.getItem(NOTICE_KEY);
    if (message) sessionStorage.removeItem(NOTICE_KEY);
    return message;
  } catch {
    return null;
  }
}
