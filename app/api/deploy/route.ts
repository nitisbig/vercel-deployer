import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  uploadFile,
  createDeployment,
  detectFramework,
  type DeployFile,
} from "@/lib/vercel";

// Allow long-running uploads/deploys.
export const maxDuration = 300;

const IGNORE: RegExp[] = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)\.next\//,
  /(^|\/)\.vercel\//,
  /(^|\/)\.turbo\//,
  /(^|\/)\.DS_Store$/,
];

function sanitizeName(raw: string): string {
  const name = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return name || "my-site";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not connected to Vercel." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read uploaded files." }, { status: 400 });
  }

  const projectName = sanitizeName((form.get("projectName") || "").toString());
  const entries = form.getAll("file");

  const files: DeployFile[] = [];
  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    const path = entry.name.replace(/^\.?\//, "");
    if (!path || IGNORE.some((re) => re.test(path))) continue;
    const data = Buffer.from(await entry.arrayBuffer());
    files.push({ file: path, data });
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No deployable files found (after ignoring build artifacts)." },
      { status: 400 }
    );
  }

  const framework = detectFramework(files);

  try {
    // Upload every file, collecting its sha + size.
    const uploaded = await Promise.all(
      files.map(async (f) => {
        const { sha, size } = await uploadFile(session.token, f.data, session.teamId);
        return { file: f.file, sha, size };
      })
    );

    const deployment = await createDeployment(session.token, {
      name: projectName,
      files: uploaded,
      framework,
      teamId: session.teamId,
    });

    return NextResponse.json({
      ok: true,
      id: deployment.id,
      url: deployment.url ? `https://${deployment.url}` : null,
      inspectorUrl: deployment.inspectorUrl,
      framework: framework ?? "static",
      fileCount: files.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Deployment failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
