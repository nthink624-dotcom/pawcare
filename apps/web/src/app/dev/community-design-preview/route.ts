// Preserve the previously shared local URL while opening the real community.
export function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, {
    status: 307,
    headers: { Location: new URL("/owner?screen=community", request.url).toString(), "Cache-Control": "no-store" },
  });
}
