import { redirect } from "next/navigation";

export default function MobileSafeAreaDemoPage() {
  redirect("/owner/mobile" as never);
}
