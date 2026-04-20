import { pool } from "../db.js";

export async function saveAppealIpMeta({
  appealId,
  ip_address = null,
  country = null,
  region = null,
  city = null,
  provider = null,
  org = null,
  user_agent = null,
  lookup_source = null,
  raw_response = null
}) {
  if (!appealId) return null;

  const result = await pool.query(
    `
    INSERT INTO clair_appeal_ip_meta (
      appeal_id,
      ip_address,
      country,
      region,
      city,
      provider,
      org,
      user_agent,
      lookup_source,
      raw_response
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (appeal_id)
    DO UPDATE SET
      ip_address    = EXCLUDED.ip_address,
      country       = EXCLUDED.country,
      region        = EXCLUDED.region,
      city          = EXCLUDED.city,
      provider      = EXCLUDED.provider,
      org           = EXCLUDED.org,
      user_agent    = EXCLUDED.user_agent,
      lookup_source = EXCLUDED.lookup_source,
      raw_response  = EXCLUDED.raw_response,
      updated_at    = NOW()
    RETURNING *
    `,
    [
      Number(appealId),
      ip_address,
      country,
      region,
      city,
      provider,
      org,
      user_agent,
      lookup_source,
      raw_response
    ]
  );

  return result.rows[0];
}