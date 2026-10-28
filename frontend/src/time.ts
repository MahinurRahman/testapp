import { format } from "date-fns";

// Good: device-local time. Broken: hardcoded UTC+14 "server zone" leaks into the UI.
export function formatTime(iso: string, broken: boolean) {
  const d = new Date(iso);
  if (!broken) return format(d, "MMM d, HH:mm");
  const shifted = new Date(d.getTime() + (14 * 60 + d.getTimezoneOffset()) * 60000);
  return format(shifted, "MMM d, HH:mm");
}
