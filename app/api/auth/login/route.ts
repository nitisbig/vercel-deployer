import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const clientId = process.env.VERCEL_CLIENT_ID;
  const appUrl = process.env.APP_URL || new URL(req.url).origin;

  if (!clientId) {
    // No OAuth integration configured — point the user at token-based connect.
    return NextResponse.redirect(`${appUrl}/?error=oauth_not_configured`);
  }

  const redirectUri = `${appUrl}/api/auth/callback`;
  const authorize = new URL("https://vercel.com/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authorize.toString());
}
