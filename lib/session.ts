import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE = "deployer_session";
const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret-change-me";

export type Session = {
  token: string;
  teamId?: string | null;
  username?: string;
  email?: string;
};

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function serialize(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function deserialize(value: string): Session | null {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  // Constant-time compare to avoid timing attacks on the signature.
  const expected = sign(payload);
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const c = store.get(COOKIE);
  if (!c) return null;
  return deserialize(c.value);
}

export async function setSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, serialize(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
