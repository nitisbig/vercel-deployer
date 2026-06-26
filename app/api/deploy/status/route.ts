import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDeployment } from "@/lib/vercel";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing deployment id." }, { status: 400 });
  }

  try {
    const d = await getDeployment(session.token, id, session.teamId);
    const primary = d.alias && d.alias.length ? d.alias[0] : d.url;
    return NextResponse.json({
      readyState: d.readyState,
      url: primary ? `https://${primary}` : null,
      errorMessage: d.errorMessage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Status check failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
