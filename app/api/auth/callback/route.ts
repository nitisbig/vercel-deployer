import { NextResponse } from "next/server";
import { exchangeCodeForToken, getUser } from "@/lib/vercel";
import { setSession } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appUrl = process.env.APP_URL || url.origin;
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?error=missing_code`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/callback`;
    const { access_token, team_id } = await exchangeCodeForToken(code, redirectUri);
    const user = await getUser(access_token);
    await setSession({
      token: access_token,
      teamId: team_id ?? null,
      username: user.username,
      email: user.email,
    });
    return NextResponse.redirect(`${appUrl}/?connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(msg)}`);
  }
}
