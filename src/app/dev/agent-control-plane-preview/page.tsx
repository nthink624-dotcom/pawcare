import { notFound } from "next/navigation";

import AgentControlPlanePreview from "@/components/admin/agent-control-plane-preview";

export default function DevelopmentAgentControlPlanePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AgentControlPlanePreview />;
}
