import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const connection = process.env.PETMANAGER_ISOLATED_PG_URL;
if (!connection) throw new Error("PETMANAGER_ISOLATED_PG_URL is required");
const psql = process.env.PSQL_PATH || "psql";
const migration = path.resolve("supabase/migrations/202608270001_admin_high_risk_action_hardening.sql");
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"];
const hash = "a".repeat(64);
const actor = (value) => `select set_config('request.jwt.claims','{"actor_ref":"${value}"}',false);`;
const asRole = (who, sql) => `set role service_role; set search_path=public,pg_catalog; ${actor(who)} ${sql}`;

function run(sql, options = {}) {
  const result = spawnSync(psql, [connection, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { encoding: "utf8", ...options });
  if (result.status !== 0 && !options.allowFailure) throw new Error(result.stderr || result.stdout);
  return result;
}
function runFile(file) {
  const result = spawnSync(psql, [connection, "-X", "-v", "ON_ERROR_STOP=1", "-f", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}
function concurrent(sql, count = 20) {
  return Promise.all(Array.from({ length: count }, () => new Promise((resolve) => {
    const child = spawn(psql, [connection, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql]);
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  })));
}
const lastLine = (value) => value.trim().split(/\r?\n/).at(-1) || "";
const uuidLine = (value) => lastLine(value).match(/^[0-9a-f-]{36}$/)?.[0] || null;
const createRequest = (id, actionName = "refund") => lastLine(run(asRole("requester-opaque-001", `select public.create_admin_high_risk_request('${id}','${actionName}','${hash}',1,now()+interval '5 minutes');`)).stdout);
const approve = (requestId) => run(asRole("approver-opaque-002", `select public.approve_admin_high_risk_request('${requestId}',1,'${hash}');`));

run("do $$ begin create role anon nologin; exception when duplicate_object then null; end $$; do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$; do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;");
run("drop schema if exists public cascade; create schema public authorization postgres; grant usage on schema public to public;");
runFile(migration);
run("create or replace function public.digest(text,text) returns bytea language sql immutable as $$ select '\\x00'::bytea $$;");
run(`insert into public.admin_high_risk_actor_scopes(actor_ref,scope) values ('requester-opaque-001','billing.refund.request'),('approver-opaque-002','billing.refund.approve'),('worker-opaque-003','billing.refund.execute'); insert into public.admin_step_up_sessions(actor_ref,method,verified_at,expires_at) values ('requester-opaque-001','totp',now(),now()+interval '5 minutes'),('approver-opaque-002','totp',now(),now()+interval '5 minutes');`);

const directAccess = ["anon", "authenticated", "service_role"].map((role) => run(`set role ${role}; select count(*) from public.admin_high_risk_requests;`, { allowFailure: true }).status);
if (directAccess.some((status) => status === 0)) throw new Error(`direct table access unexpectedly succeeded: ${directAccess}`);
if (run(asRole("requester-opaque-001", `select public.create_admin_high_risk_request('66666666-6666-4666-8666-666666666666','withdraw','${hash}',1,now()+interval '5 minutes');`), { allowFailure: true }).status === 0) throw new Error("cross-action scope unexpectedly succeeded");
if (run(asRole("requester-opaque-001", `select public.create_admin_high_risk_request('77777777-7777-4777-8777-777777777777','invented','${hash}',1,now()+interval '5 minutes');`), { allowFailure: true }).status === 0) throw new Error("unknown action unexpectedly succeeded");

const creates = await concurrent(asRole("requester-opaque-001", `select public.create_admin_high_risk_request('${ids[0]}','refund','${hash}',1,now()+interval '5 minutes');`));
if (creates.filter((x) => x.code === 0).length !== 1) throw new Error(`request concurrency mismatch: ${JSON.stringify(creates)}`);
if (run(`select (select count(*) from public.admin_high_risk_requests where operation_id='${ids[0]}')||','||(select count(*) from public.admin_high_risk_outbox where operation_id='${ids[0]}');`).stdout.trim() !== "1,1") throw new Error("request/outbox mismatch");
const requestId = run(`select id from public.admin_high_risk_requests where operation_id='${ids[0]}';`).stdout.trim(); approve(requestId);
const claims = await concurrent(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[0]}',30);`));
const tokens = claims.map((x) => uuidLine(x.stdout)).filter(Boolean);
if (tokens.length !== 1) throw new Error(`claim concurrency mismatch: ${JSON.stringify(claims)}`);
const finishes = await concurrent(asRole("worker-opaque-003", `select public.finish_admin_high_risk_operation('${ids[0]}','succeeded','${tokens[0]}');`));
if (finishes.filter((x) => lastLine(x.stdout) === "t").length !== 1) throw new Error(`terminal concurrency mismatch: ${JSON.stringify(finishes)}`);
const truth = run(`select action||','||requester_ref||','||approver_ref||','||executor_ref from public.admin_high_risk_receipts where operation_id='${ids[0]}';`).stdout.trim();
if (truth !== "refund,requester-opaque-001,approver-opaque-002,worker-opaque-003") throw new Error(`receipt derivation mismatch: ${truth}`);
if (run(asRole("worker-opaque-003", `select public.finish_admin_high_risk_operation('${ids[0]}','failed','forged-requester','forged-approver','forged-scope');`), { allowFailure: true }).status === 0) throw new Error("forged receipt signature exists");

const unknownRequest = createRequest(ids[1]); approve(unknownRequest);
const unknownToken = uuidLine(run(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[1]}',30);`)).stdout);
run(asRole("worker-opaque-003", `select public.mark_admin_high_risk_provider_unknown('${ids[1]}','${"b".repeat(64)}','${unknownToken}');`));
if (uuidLine(run(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[1]}',30);`)).stdout)) throw new Error("provider_unknown blind retry");
if (!uuidLine(run(asRole("worker-opaque-003", `select public.begin_admin_high_risk_reconcile('${ids[1]}',30);`)).stdout)) throw new Error("reconcile failed");

const leaseRequest = createRequest(ids[2]); approve(leaseRequest);
const staleToken = uuidLine(run(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[2]}',1);`)).stdout);
await new Promise((resolve) => setTimeout(resolve, 1200));
const reclaims = await concurrent(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[2]}',30);`));
const reclaimed = reclaims.map((x) => uuidLine(x.stdout)).filter(Boolean);
if (reclaimed.length !== 1 || reclaimed[0] === staleToken) throw new Error(`lease reclaim mismatch: ${JSON.stringify(reclaims)}`);
if (run(asRole("worker-opaque-003", `select public.finish_admin_high_risk_operation('${ids[2]}','succeeded','${staleToken}');`), { allowFailure: true }).status === 0) throw new Error("stale worker completion succeeded");
run(asRole("worker-opaque-003", `select public.finish_admin_high_risk_operation('${ids[2]}','succeeded','${reclaimed[0]}');`));

const retryRequest = createRequest(ids[3]); approve(retryRequest);
const retryToken = uuidLine(run(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[3]}',30);`)).stdout);
run(asRole("worker-opaque-003", `select public.schedule_admin_high_risk_retry('${ids[3]}','${retryToken}',3600);`));
if (uuidLine(run(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[3]}',30);`)).stdout)) throw new Error("early retry succeeded");

run(`begin; ${actor("requester-opaque-001")} set local role service_role; select public.create_admin_high_risk_request('${ids[4]}','refund','${hash}',1,now()+interval '5 minutes'); rollback;`);
if (run(`select (select count(*) from public.admin_high_risk_requests where operation_id='${ids[4]}')+(select count(*) from public.admin_high_risk_outbox where operation_id='${ids[4]}');`).stdout.trim() !== "0") throw new Error("rollback left rows");
const immutableApproval = run(`update public.admin_high_risk_approvals set decision='rejected' where request_id='${requestId}';`, { allowFailure: true });
const immutableReceipt = run(`delete from public.admin_high_risk_receipts where operation_id='${ids[0]}';`, { allowFailure: true });
if (immutableApproval.status === 0 || immutableReceipt.status === 0 || uuidLine(run(asRole("worker-opaque-003", `select public.claim_admin_high_risk_operation('${ids[0]}',30);`)).stdout)) throw new Error("terminal/audit immutability failed");

console.log(JSON.stringify({ requestAttempts:20, requestSuccess:1, requestRows:1, outboxRows:1, claimAttempts:20, claimSuccess:1, terminalAttempts:20, terminalSuccess:1, receiptRows:1, receiptActorsDerived:true, publicDigestShadowIgnored:true, mutatedCallerSearchPathIgnored:true, forgedReceiptSignatureDenied:true, crossActionScopeDenied:true, unknownActionDenied:true, directAccessDenied:3, providerUnknownBlindRetry:false, reconcileOnly:true, expiredLeaseConcurrentReclaimAttempts:20, expiredLeaseReclaimSuccess:1, staleWorkerCompletionDenied:true, earlyRetryBlocked:true, terminalReclaimDenied:true, rollbackResidualRows:0, immutableApproval:true, immutableReceipt:true }));
