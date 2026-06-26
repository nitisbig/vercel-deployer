import { NextResponse } from "next/server";
import { exchangeCodeForToken, getUser, getTeam } from "@/lib/vercel";
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

    // Integration tokens are scoped to a team/installation, so /v2/user often
    // returns "user not found". Resolve a friendly label without ever failing
    // the connection: prefer the team name, then the personal user, then a
    // generic fallback. The token + team_id are all we actually need to deploy.
    let username = "Vercel account";
    let email: string | undefined;

    if (team_id) {
      try {
        const team = await getTeam(access_token, team_id);
        if (team.name || team.slug) username = team.name || team.slug!;
      } catch {
        // ignore — fall through to user/fallback
      }
    }

    if (username === "Vercel account") {
      try {
        const user = await getUser(access_token);
        username = user.username || username;
        email = user.email;
      } catch {
        // ignore — keep the generic label
      }
    }

    await setSession({ token: access_token, teamId: team_id ?? null, username, email });
    return NextResponse.redirect(`${appUrl}/?connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(msg)}`);
  }
}
