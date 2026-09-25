import { redirect } from "next/navigation";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ mode?: string; token?: string; t?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialMode = resolvedSearchParams?.mode === "manage" ? "manage" : "first";
  const token = resolvedSearchParams?.t || resolvedSearchParams?.token;

  if (shopId === "demo-shop") {
    const nextUrl = new URL(initialMode === "manage" ? "/demo/book/manage" : "/demo/book/start", "http://localhost");
    if (token) {
      nextUrl.searchParams.set("t", token);
    }
    redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
  }

  const nextUrl = new URL(
    initialMode === "manage" ? `/book/${encodeURIComponent(shopId)}/manage` : `/book/${encodeURIComponent(shopId)}`,
    "http://localhost",
  );

  if (token) {
    nextUrl.searchParams.set("t", token);
  }

  redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
}
