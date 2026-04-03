const fs = require("node:fs");
const path = require("node:path");

type JobState = "running" | "completed" | "failed";

type JobRecord = {
  jobId: string;
  title: string;
  status: JobState;
  startedAt: string;
  finishedAt: string | null;
  summary: string;
  changedFiles: string[];
  notes: string[];
};

type ParsedArgs = Record<string, string[]>;

const ROOT_DIR = path.resolve(__dirname, "..");
const STATUS_DIR = path.join(ROOT_DIR, ".pawcare-status");
const JOBS_DIR = path.join(STATUS_DIR, "jobs");
const LAST_JOB_FILE = path.join(STATUS_DIR, "last-job.json");

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      throw new Error(`지원하지 않는 인자입니다: ${token}`);
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? "true" : next;

    if (!parsed[key]) {
      parsed[key] = [];
    }

    parsed[key].push(value);

    if (value !== "true") {
      index += 1;
    }
  }

  return parsed;
}

function getFirst(args: ParsedArgs, key: string): string | undefined {
  return args[key]?.[0];
}

function getMany(args: ParsedArgs, key: string): string[] {
  return args[key] ?? [];
}

function normalizeChangedFiles(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function ensureStore(): void {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

function writeJob(job: JobRecord): void {
  ensureStore();
  const filePath = path.join(JOBS_DIR, `${job.jobId}.json`);
  const payload = `${JSON.stringify(job, null, 2)}\n`;

  fs.writeFileSync(filePath, payload, "utf8");
  fs.writeFileSync(LAST_JOB_FILE, payload, "utf8");
}

function readJson(filePath: string): JobRecord {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readLastJob(): JobRecord {
  if (!fs.existsSync(LAST_JOB_FILE)) {
    throw new Error("마지막 작업 상태 파일이 없습니다.");
  }

  return readJson(LAST_JOB_FILE);
}

function readJob(jobId?: string): JobRecord {
  if (!jobId) {
    return readLastJob();
  }

  const filePath = path.join(JOBS_DIR, `${jobId}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`작업 이력을 찾을 수 없습니다: ${jobId}`);
  }

  return readJson(filePath);
}

function makeTimestamp(date: Date): string {
  const year = date.getFullYear().toString();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "job";
}

function formatDate(date: Date): string {
  return date.toISOString();
}

function formatList(job: JobRecord): string {
  const finishedAt = job.finishedAt ?? "-";
  return [
    `${job.status.toUpperCase().padEnd(10)} ${job.jobId}`,
    `  title: ${job.title}`,
    `  startedAt: ${job.startedAt}`,
    `  finishedAt: ${finishedAt}`,
    `  changedFiles: ${job.changedFiles.length}`,
    `  summary: ${job.summary || "-"}`,
  ].join("\n");
}

function printJob(job: JobRecord): void {
  console.log(`jobId: ${job.jobId}`);
  console.log(`title: ${job.title}`);
  console.log(`status: ${job.status}`);
  console.log(`startedAt: ${job.startedAt}`);
  console.log(`finishedAt: ${job.finishedAt ?? "-"}`);
  console.log(`summary: ${job.summary || "-"}`);
  console.log(
    `changedFiles: ${job.changedFiles.length ? job.changedFiles.join(", ") : "-"}`
  );
  console.log(`notes: ${job.notes.length ? job.notes.join(" | ") : "-"}`);
  console.log(`lastFile: ${LAST_JOB_FILE}`);
}

function createJob(args: ParsedArgs): void {
  const title = getFirst(args, "title");

  if (!title) {
    throw new Error("--title 값이 필요합니다.");
  }

  const now = new Date();
  const jobId = getFirst(args, "job-id") ?? `${makeTimestamp(now)}-${slugify(title)}`;
  const summary = getFirst(args, "summary") ?? "";
  const notes = getMany(args, "note");
  const changedFiles = normalizeChangedFiles([
    ...getMany(args, "file"),
    ...getMany(args, "changed-files"),
  ]);

  const job: JobRecord = {
    jobId,
    title,
    status: "running",
    startedAt: formatDate(now),
    finishedAt: null,
    summary,
    changedFiles,
    notes,
  };

  writeJob(job);
  console.log(`작업 상태를 시작했습니다: ${job.jobId}`);
  console.log(`lastFile: ${LAST_JOB_FILE}`);
}

function updateJob(nextState: Extract<JobState, "completed" | "failed">, args: ParsedArgs): void {
  const jobId = getFirst(args, "job-id");
  const current = readJob(jobId);
  const summary = getFirst(args, "summary");
  const notes = getMany(args, "note");
  const changedFiles = normalizeChangedFiles([
    ...getMany(args, "file"),
    ...getMany(args, "changed-files"),
  ]);

  const updated: JobRecord = {
    ...current,
    status: nextState,
    finishedAt: formatDate(new Date()),
    summary: summary ?? current.summary,
    changedFiles: changedFiles.length ? changedFiles : current.changedFiles,
    notes: notes.length ? [...current.notes, ...notes] : current.notes,
  };

  writeJob(updated);
  console.log(`작업 상태를 갱신했습니다: ${updated.jobId} -> ${updated.status}`);
  console.log(`lastFile: ${LAST_JOB_FILE}`);
}

function listJobs(args: ParsedArgs): void {
  ensureStore();
  const limitValue = getFirst(args, "limit");
  const limit = limitValue ? Number(limitValue) : 10;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit 값은 1 이상의 정수여야 합니다.");
  }

  const jobs = fs
    .readdirSync(JOBS_DIR)
    .filter((fileName: string) => fileName.endsWith(".json"))
    .map((fileName: string) => readJson(path.join(JOBS_DIR, fileName)))
    .sort((left: JobRecord, right: JobRecord) =>
      right.startedAt.localeCompare(left.startedAt)
    )
    .slice(0, limit);

  if (!jobs.length) {
    console.log("저장된 작업 이력이 없습니다.");
    return;
  }

  jobs.forEach((job: JobRecord, index: number) => {
    if (index > 0) {
      console.log("");
    }

    console.log(formatList(job));
  });
}

function printUsage(): void {
  console.log("사용법:");
  console.log('  npm run status:start -- --title "작업 제목" [--summary "요약"] [--note "메모"]');
  console.log('  npm run status:complete -- [--job-id "작업ID"] [--summary "요약"] [--file "src/a.ts"]');
  console.log('  npm run status:fail -- [--job-id "작업ID"] [--summary "실패 사유"] [--note "메모"]');
  console.log("  npm run status:last");
  console.log("  npm run status:list -- --limit 20");
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(rest);

  switch (command) {
    case "start":
      createJob(args);
      return;
    case "complete":
      updateJob("completed", args);
      return;
    case "fail":
      updateJob("failed", args);
      return;
    case "last":
      printJob(readLastJob());
      return;
    case "list":
      listJobs(args);
      return;
    default:
      throw new Error(`지원하지 않는 명령입니다: ${command}`);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  console.error(message);
  process.exitCode = 1;
}
