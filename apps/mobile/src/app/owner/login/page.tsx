import { redirect } from "next/navigation";

export default function LegacyOwnerLoginPage() {
  redirect("/login" as never);
}
