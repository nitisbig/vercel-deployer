"use client";

import { useEffect, useRef, useState } from "react";

type Me = {
  connected: boolean;
  username?: string;
  email?: string;
  oauthConfigured?: boolean;
};

type LogLine = { kind: "info" | "ok" | "err"; text: string };

const IGNORE = [
  "node_modules/",
  ".git/",
  ".next/",
  ".vercel/",
  ".turbo/",
  ".DS_Store",
];

function shouldIgnore(path: string): boolean {
  return IGNORE.some((p) => path.includes(p));
}

function detectFrameworkLabel(files: { path: string; file: File }[]): string {
  const pkg = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  if (!pkg) return "Static HTML";
  return "Detected on deploy";
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [picked, setPicked] = useState<{ path: string; file: File }[]>([]);
  const [projectName, setProjectName] = useState("");
  const folderInput = useRef<HTMLInputElement>(null);

  const [deploying, setDeploying] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  async function refreshMe() {
    const res = await fetch("/api/me");
    setMe(await res.json());
  }

  useEffect(() => {
    refreshMe();
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "oauth_not_configured") {
      setAuthError("OAuth isn't configured. Use an access token below, or set up an integration.");
    } else if (err === "integration_slug_missing") {
      setAuthError(
        "Set VERCEL_INTEGRATION_SLUG in .env.local (your integration's URL slug), then restart the dev server."
      );
    } else if (err) {
      setAuthError(decodeURIComponent(err));
    }
    if (params.get("connected") || err) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  function addLog(kind: LogLine["kind"], text: string) {
    setLog((l) => [...l, { kind, text }]);
  }

  async function connectWithToken() {
    setConnecting(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to connect");
      setToken("");
      await refreshMe();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await fetch("/api/auth/logout", { method: "POST" });
    setPicked([]);
    setResultUrl(null);
    setLog([]);
    await refreshMe();
  }

  function onFolderSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;

    // Strip the common top-level folder from each path.
    const rels = list.map((f) => (f as any).webkitRelativePath || f.name);
    const firstSeg = rels[0].split("/")[0];
    const allShare = rels.every((r) => r.split("/")[0] === firstSeg && r.includes("/"));

    const collected: { path: string; file: File }[] = [];
    list.forEach((file, i) => {
      let path = rels[i];
      if (allShare) path = path.slice(firstSeg.length + 1);
      if (!path || shouldIgnore(path)) return;
      collected.push({ path, file });
    });

    setPicked(collected);
    setResultUrl(null);
    setDeployError(null);
    setLog([]);
    if (!projectName && allShare) setProjectName(firstSeg);
  }

  async function deploy() {
    if (picked.length === 0) return;
    setDeploying(true);
    setResultUrl(null);
    setDeployError(null);
    setLog([]);
    addLog("info", `Preparing ${picked.length} files…`);

    try {
      const form = new FormData();
      form.set("projectName", projectName || "my-site");
      for (const { path, file } of picked) {
        form.append("file", file, path);
      }

      addLog("info", "Uploading to Vercel…");
      const res = await fetch("/api/deploy", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Deploy request failed");

      addLog("ok", `Deployment created · framework: ${json.framework}`);
      addLog("info", "Building…");

      const finalUrl = await pollStatus(json.id, json.url);
      if (finalUrl) {
        setResultUrl(finalUrl);
        addLog("ok", "Deployment is READY 🎉");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deploy failed";
      setDeployError(msg);
      addLog("err", msg);
    } finally {
      setDeploying(false);
    }
  }

  async function pollStatus(id: string, fallbackUrl: string | null): Promise<string | null> {
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      let json: any;
      try {
        const res = await fetch(`/api/deploy/status?id=${encodeURIComponent(id)}`);
        json = await res.json();
        if (!res.ok) throw new Error(json.error || "Status check failed");
      } catch (e) {
        addLog("err", e instanceof Error ? e.message : "Status check failed");
        continue;
      }
      const state = json.readyState;
      if (state === "READY") return json.url || fallbackUrl;
      if (state === "ERROR" || state === "CANCELED") {
        throw new Error(json.errorMessage || `Deployment ${state.toLowerCase()}`);
      }
      addLog("info", `…${(state || "BUILDING").toLowerCase()}`);
    }
    // Timed out waiting — return whatever URL we have.
    return fallbackUrl;
  }

  const connected = me?.connected;
  const step2Disabled = !connected;
  const step3Disabled = !connected || picked.length === 0;

  return (
    <main className="wrap">
      <div className="brand">
        <div className="logo">▲</div>
        <h1>Deployer Agent</h1>
      </div>
      <p className="sub">
        Connect Vercel, upload your project, and ship it live in a few clicks.
        Works with HTML, React, Next.js, Svelte, Astro, Vite &amp; more.
      </p>

      {/* STEP 1 — Connect */}
      <section className="card">
        <div className="step-head">
          <div className={`step-num ${connected ? "done" : "active"}`}>{connected ? "✓" : "1"}</div>
          <div className="step-title">Connect your Vercel account</div>
        </div>

        {connected ? (
          <div className="row">
            <div className="account">
              <div className="avatar" />
              <div>
                <div style={{ fontWeight: 600 }}>{me?.username || "Connected"}</div>
                {me?.email && <div className="muted">{me.email}</div>}
              </div>
            </div>
            <button className="btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <>
            <p className="step-desc">
              Authorize once. We never store your password — only a session-scoped token.
            </p>
            <div className="row">
              <a className="btn btn-primary" href="/api/auth/login">
                Connect Vercel
              </a>
            </div>

            <div className="divider">or use an access token</div>
            <div className="row">
              <input
                type="password"
                placeholder="Paste a Vercel access token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button
                className="btn-primary"
                onClick={connectWithToken}
                disabled={connecting || !token.trim()}
              >
                {connecting ? <span className="spinner" /> : "Connect"}
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Create one at{" "}
              <a
                href="https://vercel.com/account/settings/tokens"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent-2)" }}
              >
                vercel.com/account/settings/tokens
              </a>
            </p>
          </>
        )}

        {authError && <div className="error-box">{authError}</div>}
      </section>

      {/* STEP 2 — Upload */}
      <section className={`card ${step2Disabled ? "disabled" : ""}`}>
        <div className="step-head">
          <div className={`step-num ${picked.length ? "done" : connected ? "active" : ""}`}>
            {picked.length ? "✓" : "2"}
          </div>
          <div className="step-title">Select your project folder</div>
        </div>
        <p className="step-desc">
          Pick the folder that contains your <code>index.html</code> or{" "}
          <code>package.json</code>. We skip <code>node_modules</code> and build
          output automatically.
        </p>

        <div className="dropzone" onClick={() => folderInput.current?.click()}>
          📁 Click to choose a project folder
        </div>
        <input
          ref={folderInput}
          type="file"
          multiple
          onChange={onFolderSelected}
          style={{ display: "none" }}
          {...({ webkitdirectory: "", directory: "" } as any)}
        />

        {picked.length > 0 && (
          <>
            <div className="row" style={{ marginTop: 14 }}>
              <span className="badge">{picked.length} files</span>
              <span className="badge">{detectFrameworkLabel(picked)}</span>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <label className="muted" style={{ minWidth: 100 }}>
                Project name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-site"
                style={{ flex: 1 }}
              />
            </div>
            <div className="filelist">
              {picked.slice(0, 60).map((f) => (
                <div className="fl-row" key={f.path}>
                  <span>{f.path}</span>
                  <span>{(f.file.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
              {picked.length > 60 && (
                <div className="fl-row">
                  <span>…and {picked.length - 60} more</span>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* STEP 3 — Deploy */}
      <section className={`card ${step3Disabled ? "disabled" : ""}`}>
        <div className="step-head">
          <div className={`step-num ${resultUrl ? "done" : picked.length ? "active" : ""}`}>
            {resultUrl ? "✓" : "3"}
          </div>
          <div className="step-title">Deploy</div>
        </div>
        <p className="step-desc">One click and your site goes live on Vercel.</p>

        <button className="btn btn-deploy" onClick={deploy} disabled={deploying || step3Disabled}>
          {deploying ? (
            <>
              <span className="spinner" /> Deploying…
            </>
          ) : (
            <>🚀 Deploy to Vercel</>
          )}
        </button>

        {log.length > 0 && (
          <div className="log">
            {log.map((l, i) => (
              <div className={`ln ${l.kind}`} key={i}>
                <span>{l.kind === "ok" ? "✓" : l.kind === "err" ? "✕" : "›"}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        )}

        {resultUrl && (
          <div className="result">
            <div className="muted" style={{ marginBottom: 6 }}>
              Your site is live:
            </div>
            <a href={resultUrl} target="_blank" rel="noreferrer">
              {resultUrl}
            </a>
          </div>
        )}

        {deployError && <div className="error-box">{deployError}</div>}
      </section>

      <p className="footer">
        MVP · Vercel connector · more providers (Cloudflare, AWS, Azure, GCP, Hostinger) coming soon
      </p>
    </main>
  );
}
