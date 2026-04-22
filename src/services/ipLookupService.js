import { isPrivateOrLocalIp } from "../utils/requestMeta.js";

export async function lookupIpMeta(ip) {
  if (!ip) return null;

  if (isPrivateOrLocalIp(ip)) {
    return {
      ip_address: ip,
      country: null,
      region: null,
      city: null,
      provider: null,
      org: null,
      lookup_source: "local",
      raw_response: {
        note: "private_or_local_ip"
      }
    };
  }

  const baseUrl = process.env.IP_LOOKUP_URL || "https://ipwho.is";
  const url = `${baseUrl}/${encodeURIComponent(ip)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      return {
        ip_address: ip,
        country: null,
        region: null,
        city: null,
        provider: null,
        org: null,
        lookup_source: "ipwho.is",
        raw_response: {
          error: `lookup_failed_status_${response.status}`
        }
      };
    }

    const data = await response.json();

    if (data?.success === false) {
      return {
        ip_address: ip,
        country: null,
        region: null,
        city: null,
        provider: null,
        org: null,
        lookup_source: "ipwho.is",
        raw_response: data
      };
    }

    return {
      ip_address: ip,
      country: data?.country || null,
      region: data?.region || null,
      city: data?.city || null,
      provider: data?.connection?.isp || null,
      org: data?.connection?.org || null,
      lookup_source: "ipwho.is",
      raw_response: data
    };
  } catch (error) {
    console.error("❌ IP lookup error:", error?.message || error);

    return {
      ip_address: ip,
      country: null,
      region: null,
      city: null,
      provider: null,
      org: null,
      lookup_source: "ipwho.is",
      raw_response: {
        error: error?.message || "unknown_lookup_error"
      }
    };
  }
}