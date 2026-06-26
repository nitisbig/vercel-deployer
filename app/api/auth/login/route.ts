import { NextResponse } from "next/server";

/**
 * Start the Vercel connect flow.
 *
 * Vercel has two different OAuth entry points:
 *  - Marketplace/Developer **Integrations** (client id `oac_...`) are installed
 *    via a slug URL:  https://vercel.com/integrations/<slug>/new
 *  - "Sign in with Vercel" apps use:  https://vercel.com/oauth/authorize?client_id=...
 *
 * This app uses an Integration (token exchange at /v2/oauth/access_token), so we
 * redirect to the integration install URL built from VERCEL_INTEGRATION_SLUG.
 */
export async function GET(req: Request) {
  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  const slug = process.env.VERCEL_INTEGRATION_SLUG;

  if (!slug) {
    return NextResponse.redirect(`${appUrl}/?error=integration_slug_missing`);
  }

  return NextResponse.redirect(`https://vercel.com/integrations/${slug}/new`);
}
