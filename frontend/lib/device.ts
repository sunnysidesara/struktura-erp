/**
 * Turn a raw user-agent string into something readable, e.g. "Chrome / Windows".
 * It only reformats real data — nothing is invented when the value is missing.
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) {
    return "Unknown device";
  }

  const ua = userAgent.toLowerCase();
  let browser = "";
  let platform = "";

  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") || ua.includes("crios/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/")) browser = "Safari";
  else if (ua.includes("powershell/")) browser = "PowerShell";
  else if (ua.includes("curl/")) browser = "curl";

  if (ua.includes("windows")) platform = "Windows";
  else if (ua.includes("android")) platform = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) platform = "iOS";
  else if (ua.includes("mac os")) platform = "macOS";
  else if (ua.includes("linux")) platform = "Linux";

  if (browser && platform) {
    return `${browser} / ${platform}`;
  }

  return browser || platform || userAgent.slice(0, 48);
}
