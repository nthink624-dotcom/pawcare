// Temporary diagnostic route for production relay connectivity checks.
export const runtime = "nodejs";

type DebugResult = {
  ok: boolean;
  vercelEnv: string | null;
  nodeEnv: string | null;
  env: {
    hasRelayUrl: boolean;
    hasRelaySecret: boolean;
    relaySecretLength: number;
    relayUrlHost: string | null;
    relayUrlPathname: string | null;
  };
  health: {
    urlHost: string;
    urlPathname: string;
    status: number;
    ok: boolean;
    bodyPreview: string;
  } | null;
};

export async function GET() {
  const relayUrl = process.env.ALIMTALK_RELAY_URL;
  const relaySecret = process.env.ALIMTALK_RELAY_SECRET;

  const result: DebugResult = {
    ok: true,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    env: {
      hasRelayUrl: Boolean(relayUrl),
      hasRelaySecret: Boolean(relaySecret),
      relaySecretLength: relaySecret ? relaySecret.length : 0,
      relayUrlHost: null,
      relayUrlPathname: null,
    },
    health: null,
  };

  if (!relayUrl) {
    return Response.json({
      ...result,
      ok: false,
      reason: "ALIMTALK_RELAY_URL is missing",
    });
  }

  try {
    const parsedRelayUrl = new URL(relayUrl);
    result.env.relayUrlHost = parsedRelayUrl.host;
    result.env.relayUrlPathname = parsedRelayUrl.pathname;

    const healthUrl = new URL(parsedRelayUrl.toString());
    healthUrl.pathname = "/health";
    healthUrl.search = "";
    healthUrl.hash = "";

    const response = await fetch(healthUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const bodyText = await response.text();

    result.health = {
      urlHost: healthUrl.host,
      urlPathname: healthUrl.pathname,
      status: response.status,
      ok: response.ok,
      bodyPreview: bodyText.slice(0, 500),
    };

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ...result,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
