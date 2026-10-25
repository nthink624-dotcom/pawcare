import FocusedApprovalRoute from "@/components/admin/focused-approval-route";

export default async function AdminApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FocusedApprovalRoute approvalId={id} />;
}
