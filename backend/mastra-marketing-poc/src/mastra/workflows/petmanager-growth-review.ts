import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const workItemInputSchema = z.object({
  workItemId: z.string().min(1).max(100),
  goal: z.string().min(1).max(500),
  signalSummary: z.string().min(1).max(2000),
  evidenceLinks: z.array(z.string().url()).max(10).default([]),
});

const signalPacketSchema = workItemInputSchema.extend({
  source: z.literal("petmanager-marketing-war-room"),
  guardrails: z.array(z.string()),
});

const reviewRequestSchema = signalPacketSchema.extend({
  requestedReviewer: z.literal("codex"),
  proposedAction: z.literal("measurement-plan-review"),
  reviewQuestions: z.array(z.string()),
});

const decisionSchema = z.object({
  decision: z.enum(["approve", "revise", "hold", "reject"]),
  note: z.string().max(1000).default(""),
});

const workflowOutputSchema = z.object({
  workItemId: z.string(),
  status: z.enum(["approved", "revision_requested", "on_hold", "rejected"]),
  decisionNote: z.string(),
  externalExecution: z.literal(false),
});

const normalizeSignal = createStep({
  id: "normalize-marketing-signal",
  description: "측정 신호를 Codex가 검토할 수 있는 안전한 패킷으로 정리합니다.",
  inputSchema: workItemInputSchema,
  outputSchema: signalPacketSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    source: "petmanager-marketing-war-room" as const,
    guardrails: [
      "실제 측정값이 없으면 성과 수치를 만들지 않는다.",
      "광고·메시지·게시·예산 변경은 사람 승인 전 실행하지 않는다.",
      "Production 데이터와 외부 계정은 이 POC에서 변경하지 않는다.",
    ],
  }),
});

const requestCodexReview = createStep({
  id: "request-codex-review",
  description: "성장팀 제안을 Codex 검토 큐에 맞는 형태로 바꿉니다.",
  inputSchema: signalPacketSchema,
  outputSchema: reviewRequestSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    requestedReviewer: "codex" as const,
    proposedAction: "measurement-plan-review" as const,
    reviewQuestions: [
      "근거 링크가 목표와 직접 연결되는가?",
      "측정 이벤트와 성공 기준이 명확한가?",
      "외부 실행 없이 검증 가능한 다음 행동인가?",
    ],
  }),
});

const waitForOwnerApproval = createStep({
  id: "wait-for-owner-approval",
  description: "사람의 승인·수정·보류·반려 결정을 기다립니다.",
  inputSchema: reviewRequestSchema,
  outputSchema: workflowOutputSchema,
  resumeSchema: decisionSchema,
  suspendSchema: z.object({
    workItemId: z.string(),
    requestedReviewer: z.literal("codex"),
    proposedAction: z.literal("measurement-plan-review"),
    approvalMessage: z.string(),
    externalExecution: z.literal(false),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend({
        workItemId: inputData.workItemId,
        requestedReviewer: inputData.requestedReviewer,
        proposedAction: inputData.proposedAction,
        approvalMessage: "Codex 검토 후 사람이 결정을 내려야 다음 단계로 넘어갑니다.",
        externalExecution: false,
      });
    }

    const statusByDecision = {
      approve: "approved",
      revise: "revision_requested",
      hold: "on_hold",
      reject: "rejected",
    } as const;

    return {
      workItemId: inputData.workItemId,
      status: statusByDecision[resumeData.decision],
      decisionNote: resumeData.note,
      externalExecution: false as const,
    };
  },
});

export const petmanagerGrowthReviewWorkflow = createWorkflow({
  id: "petmanager-growth-review",
  description: "측정 신호를 Codex 검토와 사람 승인까지 전달하는 읽기 전용 POC입니다.",
  inputSchema: workItemInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(normalizeSignal)
  .then(requestCodexReview)
  .then(waitForOwnerApproval)
  .commit();
