import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("first reservation-specific service edit creates its custom service before updating the appointment", async () => {
  const [screen, schemas] = await Promise.all([
    readSource("src/components/owner-web/calendar-management-screen.tsx"),
    readSource("src/server/schemas.ts"),
  ]);

  assert.match(schemas, /const operation = value\.operation \?\? \(value\.serviceId \? "update" : "create"\)/);
  assert.match(screen, /const customServiceExists = bootstrapData\.services\.some\(\(service\) => service\.id === customServiceId\)/);
  assert.match(screen, /operation: customServiceExists \? "update" : "create"/);
  assert.match(screen, /\.\.\.\(!customServiceExists \? \{ requestId: crypto\.randomUUID\(\) \} : \{\}\)/);
});

test("reservation detail validation failures return Korean recovery messages instead of Zod issue codes", async () => {
  const [appointmentsRoute, servicesRoute, calendarScreen, staffRoute] = await Promise.all([
    readSource("src/app/api/appointments/route.ts"),
    readSource("src/app/api/services/route.ts"),
    readSource("src/components/owner-web/calendar-management-screen.tsx"),
    readSource("src/app/api/staff-members/route.ts"),
  ]);

  assert.match(appointmentsRoute, /error instanceof z\.ZodError[\s\S]*?예약 수정 내용을 다시 확인해 주세요\./);
  assert.match(servicesRoute, /error instanceof z\.ZodError[\s\S]*?서비스 저장 내용을 다시 확인해 주세요\./);
  assert.match(calendarScreen, /fetchApiJsonWithAuth<Appointment>\("\/api\/appointments"/);
  assert.doesNotMatch(calendarScreen, /\/api\/staff-members/);
  assert.match(staffRoute, /staffChipColorIndexMax/);
});
