export function getClientIp(req) {
  const xForwardedFor = req.headers["x-forwarded-for"];
  const xRealIp = req.headers["x-real-ip"];

  let ip = null;

  if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
    ip = xForwardedFor.split(",")[0].trim();
  } else if (typeof xRealIp === "string" && xRealIp.trim()) {
    ip = xRealIp.trim();
  } else {
    ip = req.socket?.remoteAddress || req.ip || null;
  }

  if (!ip) return null;

  // ::ffff:1.2.3.4 -> 1.2.3.4
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  return ip;
}

export function getUserAgent(req) {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : "";
}

export function isPrivateOrLocalIp(ip) {
  if (!ip) return true;

  const value = ip.trim().toLowerCase();

  return (
    value === "::1" ||
    value === "127.0.0.1" ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value) ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:")
  );
}