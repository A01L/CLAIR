import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";

function signAccessToken({ userId, login }) {
  const secret = process.env.JWT_SECRET;
  const ttl = process.env.JWT_ACCESS_TTL || "15m";

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return jwt.sign(
    { sub: String(userId), login },
    secret,
    { expiresIn: ttl }
  );
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || null;
}

function parseDeviceInfo(userAgent = "") {
  const ua = userAgent.toLowerCase();

  let device_type = "unknown";
  let browser = "unknown";
  let os = "unknown";

  // device
  if (/ipad|tablet/.test(ua)) {
    device_type = "tablet";
  } else if (/mobile|android|iphone/.test(ua)) {
    device_type = "mobile";
  } else {
    device_type = "desktop";
  }

  // browser
  if (ua.includes("edg")) {
    browser = "edge";
  } else if (ua.includes("chrome")) {
    browser = "chrome";
  } else if (ua.includes("firefox")) {
    browser = "firefox";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "safari";
  } else if (ua.includes("opr") || ua.includes("opera")) {
    browser = "opera";
  }

  // os
  if (ua.includes("windows")) {
    os = "windows";
  } else if (ua.includes("android")) {
    os = "android";
  } else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
    os = "ios";
  } else if (ua.includes("mac os") || ua.includes("macintosh")) {
    os = "macos";
  } else if (ua.includes("linux")) {
    os = "linux";
  }

  return { device_type, browser, os };
}

export async function register(req, res) {
  try {
    const { username, password, full_name, email, tg_push } = req.body || {};

    const login =
      typeof username === "string"
        ? username.trim().toLowerCase()
        : "";

    if (!login || login.length < 3) {
      return res.status(400).json({
        error: "username must be at least 3 chars"
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: "password must be at least 6 chars"
      });
    }

    const exists = await pool.query(
      `SELECT 1
       FROM clair_users
       WHERE login = $1
          OR ($2::text IS NOT NULL AND email = $2)`,
      [login, email ?? null]
    );

    if (exists.rowCount > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const r = await pool.query(
      `INSERT INTO clair_users (login, password, full_name, email, tg_push)
       VALUES ($1, $2, $3, $4, COALESCE($5, FALSE))
       RETURNING id, login, full_name, email, tg_push`,
      [login, passwordHash, full_name ?? null, email ?? null, tg_push ?? false]
    );

    return res.status(201).json({
      ok: true,
      user: r.rows[0]
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body || {};

    const login =
      typeof username === "string"
        ? username.trim().toLowerCase()
        : "";

    if (!login || !password) {
      return res.status(400).json({
        error: "username and password required"
      });
    }

    const r = await pool.query(
      `SELECT id, login, password
       FROM clair_users
       WHERE login = $1`,
      [login]
    );

    if (r.rowCount === 0) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const accessToken = signAccessToken({
      userId: user.id,
      login: user.login
    });

    const userAgent = req.headers["user-agent"] || "";
    const ip = getClientIp(req);
    const { device_type, browser, os } = parseDeviceInfo(userAgent);

    await pool.query(
      `INSERT INTO clair_login_logs
       (user_id, login_at, ip_address, user_agent, device_type, browser, os, is_success)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, TRUE)`,
      [user.id, ip, userAgent, device_type, browser, os]
    );

    return res.json({
      access_token: accessToken,
      token_type: "Bearer"
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function me(req, res) {
  try {
    const r = await pool.query(
      `SELECT
          u.id,
          u.login,
          u.full_name,
          u.email,
          u.tg_push,
          ll.login_at       AS last_login_at,
          ll.ip_address     AS last_login_ip,
          ll.user_agent     AS last_user_agent,
          ll.device_type    AS last_device_type,
          ll.browser        AS last_browser,
          ll.os             AS last_os
       FROM clair_users u
       LEFT JOIN LATERAL (
         SELECT
           login_at,
           ip_address,
           user_agent,
           device_type,
           browser,
           os
         FROM clair_login_logs
         WHERE user_id = u.id
         ORDER BY login_at DESC
         LIMIT 1
       ) ll ON TRUE
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(r.rows[0]);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function loginHistory(req, res) {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isInteger(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 100)
      : 20;

    const r = await pool.query(
      `SELECT
          id,
          login_at,
          ip_address,
          user_agent,
          device_type,
          browser,
          os,
          is_success
       FROM clair_login_logs
       WHERE user_id = $1
       ORDER BY login_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );

    return res.json({
      ok: true,
      items: r.rows
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}