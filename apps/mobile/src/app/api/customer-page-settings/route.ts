import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

const customerPageSettingsSchema = z.object({
  shopId: z.string().min(1),
  customerPageSettings: z.record(z.string(), z.unknown()),
});

export async function PATCH(request: NextRequest) {
  try {
    const payload = customerPageSettingsSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, payload.shopId);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);

    const current = await supabase
      .from("shops")
      .select("id,name,description,customer_page_settings")
      .eq("id", owner.shopId)
      .single();
    if (current.error) throw new OwnerApiError(current.error.message, 500);

    const nextSettings = normalizeCustomerPageSettings(
      {
        ...((current.data.customer_page_settings as Record<string, unknown> | null) ?? {}),
        ...payload.customerPageSettings,
      },
      current.data.name,
      current.data.description,
    );

    const result = await supabase
      .from("shops")
      .update({
        customer_page_settings: nextSettings,
        updated_at: nowIso(),
      })
      .eq("id", owner.shopId)
      .select("customer_page_settings")
      .single();

    if (result.error) throw new OwnerApiError(result.error.message, 500);
    return NextResponse.json({
      customerPageSettings: normalizeCustomerPageSettings(result.data.customer_page_settings, current.data.name, current.data.description),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "고객 예약 페이지 설정을 다시 확인해 주세요." }, { status: 400 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "고객 예약 페이지 설정을 저장하지 못했습니다." }, { status: 500 });
  }
}
