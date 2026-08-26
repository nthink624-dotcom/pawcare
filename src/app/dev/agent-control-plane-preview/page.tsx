import { notFound } from "next/navigation";

import DemoAgentControlPlane from "@/components/admin/demo-agent-control-plane";

export default function DevelopmentAgentControlPlanePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DemoAgentControlPlane mode="operational" />;
}
