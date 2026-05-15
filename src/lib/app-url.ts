// Returns the canonical public URL of THIS app, suitable for QR/share links.
// Avoids using the Lovable editor/sandbox origin which would mis-route invitees.
const PUBLISHED_URL = "https://safe-apt-harmony.lovable.app";

export function getAppOrigin(): string {
  if (typeof window === "undefined") return PUBLISHED_URL;
  const origin = window.location.origin;
  const host = window.location.hostname;

  // If we're inside the Lovable editor / sandbox / preview iframes, use published URL.
  const isEditor =
    host.endsWith("lovable.dev") ||
    host.includes("lovableproject.com") ||
    host.includes("sandbox") ||
    host.startsWith("id-preview--") ||
    host.includes("-preview--");

  if (isEditor) return PUBLISHED_URL;
  return origin;
}

export function buildInviteLink(token: string): string {
  return `${getAppOrigin()}/invite/${token}`;
}
