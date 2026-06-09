import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DemoBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; token?: string; date?: string; time?: string; serviceId?: string; serviceOptionId?: string; step?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  if (resolvedSearchParams?.mode === "manage") {
    const nextUrl = new URL("/demo/book/manage", "http://localhost");
    const accessToken = resolvedSearchParams.token;
    if (accessToken) nextUrl.searchParams.set("t", accessToken);
    redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
  }

  redirect("/entry/demo-shop" as never);
}
