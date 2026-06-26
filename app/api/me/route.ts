import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      connected: false,
      oauthConfigured: Boolean(process.env.VERCEL_CLIENT_ID),
    });
  }
  return NextResponse.json({
    connected: true,
    username: session.username,
    email: session.email,
    oauthConfigured: Boolean(process.env.VERCEL_CLIENT_ID),
  });
}
