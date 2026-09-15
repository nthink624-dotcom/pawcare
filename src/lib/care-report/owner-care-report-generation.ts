export type OwnerCareReportGenerationStage = "generate" | "save" | "readback";

export class OwnerCareReportGenerationStageError extends Error {
  readonly stage: OwnerCareReportGenerationStage;
  readonly preservedReportText: string | null;

  constructor(stage: OwnerCareReportGenerationStage, cause: unknown, preservedReportText: string | null = null) {
    super(cause instanceof Error ? cause.message : "케어리포트 처리에 실패했습니다.");
    this.name = "OwnerCareReportGenerationStageError";
    this.stage = stage;
    this.preservedReportText = preservedReportText;
    this.cause = cause;
  }
}

function requireReportText(value: unknown) {
  if (!value || typeof value !== "object" || !("reportText" in value)) {
    throw new Error("케어리포트 결과 형식을 확인하지 못했습니다.");
  }
  const reportText = (value as { reportText?: unknown }).reportText;
  if (typeof reportText !== "string" || !reportText.trim()) {
    throw new Error("케어리포트 결과 형식을 확인하지 못했습니다.");
  }
  return reportText.trim();
}

async function runStage<T>({
  stage,
  timeoutMs,
  preservedReportText,
  work,
}: {
  stage: OwnerCareReportGenerationStage;
  timeoutMs: number;
  preservedReportText: string | null;
  work: (signal: AbortSignal) => Promise<T>;
}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("요청 시간이 길어지고 있습니다. 다시 시도해 주세요."));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } catch (error) {
    throw new OwnerCareReportGenerationStageError(stage, error, preservedReportText);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runOwnerCareReportGeneration({
  generate,
  preserve,
  save,
  readback,
  timeouts = {},
}: {
  generate: (signal: AbortSignal) => Promise<unknown>;
  preserve: (reportText: string) => void;
  save: (reportText: string, signal: AbortSignal) => Promise<unknown>;
  readback: (signal: AbortSignal) => Promise<unknown>;
  timeouts?: Partial<Record<OwnerCareReportGenerationStage, number>>;
}) {
  const generated = await runStage({
    stage: "generate",
    timeoutMs: timeouts.generate ?? 45_000,
    preservedReportText: null,
    work: generate,
  });
  let reportText: string;
  try {
    reportText = requireReportText(generated);
  } catch (error) {
    throw new OwnerCareReportGenerationStageError("generate", error);
  }

  preserve(reportText);

  const saved = await runStage({
    stage: "save",
    timeoutMs: timeouts.save ?? 15_000,
    preservedReportText: reportText,
    work: (signal) => save(reportText, signal),
  });
  try {
    if (requireReportText(saved) !== reportText) {
      throw new Error("저장된 케어리포트가 생성 결과와 일치하지 않습니다.");
    }
  } catch (error) {
    throw new OwnerCareReportGenerationStageError("save", error, reportText);
  }

  const readbackResult = await runStage({
    stage: "readback",
    timeoutMs: timeouts.readback ?? 15_000,
    preservedReportText: reportText,
    work: readback,
  });
  try {
    const draft = readbackResult && typeof readbackResult === "object" && "draft" in readbackResult
      ? (readbackResult as { draft?: unknown }).draft
      : null;
    const canonicalReportText = requireReportText(draft);
    if (canonicalReportText !== reportText) {
      throw new Error("저장 확인 결과가 생성 결과와 일치하지 않습니다.");
    }
    return { reportText: canonicalReportText };
  } catch (error) {
    throw new OwnerCareReportGenerationStageError("readback", error, reportText);
  }
}
