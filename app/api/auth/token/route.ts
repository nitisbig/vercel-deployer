import { NextResponse } from "next/server";
import { getUser } from "@/lib/vercel";
import { setSession } from "@/lib/session";

export async function POST(req: Request) {
  let token = "";
  let teamId: string | null = null;
  try {
    const body = await req.json();
    token = (body.token || "").trim();
    teamId = body.teamId ? String(body.teamId).trim() : null;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Access token is required" }, { status: 400 });
  }

  try {
    const user = await getUser(token);
    await setSession({ token, teamId, username: user.username, email: user.email });
    return NextResponse.json({ ok: true, username: user.username, email: user.email });
  } catch {
    return NextResponse.json(
      { error: "Invalid access token — could not authenticate with Vercel." },
      { status: 401 }
    );
  }
}
