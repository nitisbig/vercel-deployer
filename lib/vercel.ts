import crypto from "node:crypto";

const API = "https://api.vercel.com";

export type DeployFile = {
  /** Path relative to the project root, e.g. "src/index.html". */
  file: string;
  /** Raw bytes of the file. */
  data: Buffer;
};

export type VercelUser = {
  username: string;
  email?: string;
  name?: string;
};

function teamQuery(teamId?: string | null): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

/** Exchange an OAuth authorization code for an access token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; team_id?: string | null }> {
  const res = await fetch(`${API}/v2/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.VERCEL_CLIENT_ID || "",
      client_secret: process.env.VERCEL_CLIENT_SECRET || "",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error_description || json?.error || "OAuth exchange failed");
  }
  return json;
}

export async function getUser(token: string): Promise<VercelUser> {
  const res = await fetch(`${API}/v2/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || "Failed to fetch Vercel user");
  }
  const u = json.user || json;
  return { username: u.username, email: u.email, name: u.name };
}

/** Upload a single file to the Vercel Files API. Returns its sha + size. */
export async function uploadFile(
  token: string,
  data: Buffer,
  teamId?: string | null
): Promise<{ sha: string; size: number }> {
  const sha = crypto.createHash("sha1").update(data).digest("hex");
  const res = await fetch(`${API}/v2/files${teamQuery(teamId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "x-vercel-digest": sha,
    },
    // Buffer is a Uint8Array; cast to satisfy the Web fetch BodyInit type.
    body: new Uint8Array(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message || `File upload failed (${res.status})`);
  }
  return { sha, size: data.byteLength };
}

export type CreatedDeployment = {
  id: string;
  url: string;
  readyState?: string;
  inspectorUrl?: string;
  alias?: string[];
};

/** Create a deployment from already-uploaded files. */
export async function createDeployment(
  token: string,
  opts: {
    name: string;
    files: { file: string; sha: string; size: number }[];
    framework?: string | null;
    teamId?: string | null;
  }
): Promise<CreatedDeployment> {
  const body: Record<string, unknown> = {
    name: opts.name,
    files: opts.files,
    target: "production",
    projectSettings: {
      framework: opts.framework ?? null,
    },
  };

  const res = await fetch(`${API}/v13/deployments${teamQuery(opts.teamId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Deployment failed (${res.status})`);
  }
  return {
    id: json.id,
    url: json.url,
    readyState: json.readyState,
    inspectorUrl: json.inspectorUrl,
    alias: json.alias,
  };
}

export async function getDeployment(
  token: string,
  id: string,
  teamId?: string | null
): Promise<{ readyState: string; url: string; alias?: string[]; errorMessage?: string }> {
  const res = await fetch(`${API}/v13/deployments/${id}${teamQuery(teamId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || "Failed to read deployment status");
  }
  return {
    readyState: json.readyState || json.status,
    url: json.url,
    alias: json.alias,
    errorMessage: json.errorMessage,
  };
}

/**
 * Detect the Vercel framework preset from a project's files.
 * Returns a framework slug, or null to let Vercel auto-detect (good for plain HTML).
 */
export function detectFramework(files: DeployFile[]): string | null {
  const pkg = files.find((f) => f.file === "package.json");
  if (!pkg) return null; // static HTML site
  let deps: Record<string, string> = {};
  try {
    const parsed = JSON.parse(pkg.data.toString("utf8"));
    deps = { ...parsed.dependencies, ...parsed.devDependencies };
  } catch {
    return null;
  }
  const has = (name: string) => Object.prototype.hasOwnProperty.call(deps, name);

  if (has("next")) return "nextjs";
  if (has("@sveltejs/kit")) return "sveltekit";
  if (has("astro")) return "astro";
  if (has("nuxt")) return "nuxt";
  if (has("@remix-run/dev")) return "remix";
  if (has("gatsby")) return "gatsby";
  if (has("svelte")) return "svelte";
  if (has("vue")) return "vue";
  if (has("react-scripts")) return "create-react-app";
  if (has("vite")) return "vite";
  return null;
}
