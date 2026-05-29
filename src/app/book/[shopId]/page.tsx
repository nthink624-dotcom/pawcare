import { redirect } from "next/navigation";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ mode?: string; token?: string; t?: string; date?: string; time?: string; serviceId?: string; serviceOptionId?: string; step?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const encodedShopId = encodeURIComponent(shopId);

  if (requestedMode === "manage") {
    const manageUrl = new URL(shopId === "demo-shop" ? "/demo/book/manage" : `/book/${encodedShopId}/manage`, "http://localhost");
    const accessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;

    if (accessToken) {
      manageUrl.searchParams.set("t", accessToken);
    }

    redirect(`${manageUrl.pathname}${manageUrl.search}` as never);
  }

  const nextUrl = new URL(`/entry/${encodedShopId}`, "http://localhost");
  if (resolvedSearchParams) {
    Object.entries(resolvedSearchParams).forEach(([key, value]) => {
      if (!value || key === "mode") return;
      nextUrl.searchParams.set(key, value);
    });
  }

  redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
}
