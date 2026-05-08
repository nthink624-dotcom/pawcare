const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(srcRoot, request.slice(2)), parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(compiled.outputText, filename);
};

const { ownerBootstrapMock } = require("../src/screens/ownerPlaceholderData");
const { createMockOwnerDataProvider } = require("../src/services/mockOwnerDataProvider");
const {
  buildAppointmentDetailViewModel,
  buildAppointmentRows,
  buildCustomerDetailViewModel,
  buildCustomerSummaries,
  buildSettingsSummaryViewModel,
  buildTodayHomeViewModel,
} = require("../src/viewModels/ownerViewModels");
const {
  getAppointmentSourceLabel,
  getAppointmentStatusLabel,
  getAppointmentStatusSection,
  isActiveAppointmentStatus,
} = require("../src/viewModels/status");

const today = "2026-05-08";
const provider = createMockOwnerDataProvider(ownerBootstrapMock, today);

const rows = buildAppointmentRows(ownerBootstrapMock, today);
assert.equal(rows.length, 5, "today appointment rows should include five mock appointments");
assert.equal(provider.getBootstrap(), ownerBootstrapMock);
assert.deepEqual(provider.getAppointmentRows(), rows);

const firstRow = rows[0];
assert.equal(firstRow.id, "R-2401");
assert.equal(firstRow.date, today);
assert.equal(firstRow.time, "10:30");
assert.equal(firstRow.customerName, ownerBootstrapMock.guardians.find((guardian) => guardian.id === "G-1001").name);
assert.equal(firstRow.guardianPhone, "010-8498-2077");
assert.equal(firstRow.petName, ownerBootstrapMock.pets.find((pet) => pet.id === "P-1001").name);
assert.equal(firstRow.serviceName, ownerBootstrapMock.services.find((service) => service.id === "S-full").name);
assert.equal(firstRow.serviceDurationMinutes, 120);
assert.equal(firstRow.status, "pending");
assert.equal(firstRow.statusLabel, "승인 대기");
assert.equal(firstRow.section, "pending");
assert.equal(firstRow.sourceLabel, getAppointmentSourceLabel("customer"));
assert.equal(firstRow.staffLabel, "담당자 미지정");

const todayHome = buildTodayHomeViewModel(ownerBootstrapMock, today);
assert.deepEqual(provider.getTodayHome(), todayHome);
assert.deepEqual(todayHome.stats, {
  pending: 1,
  active: 3,
  completed: 1,
  cancelChange: 0,
});
assert.equal(todayHome.pendingReservations.length, 1);
assert.equal(todayHome.activeReservations.length, 3);
assert.equal(todayHome.completedReservations.length, 1);
assert.equal(todayHome.cancelChangeReservations.length, 0);

const reservationDetail = buildAppointmentDetailViewModel(ownerBootstrapMock, "R-2402");
assert.deepEqual(provider.getAppointmentDetail("R-2402"), reservationDetail);
assert.ok(reservationDetail, "reservation detail should resolve by appointmentId");
assert.equal(reservationDetail.id, "R-2402");
assert.equal(reservationDetail.customerName, ownerBootstrapMock.guardians.find((guardian) => guardian.id === "G-1002").name);
assert.equal(reservationDetail.petName, ownerBootstrapMock.pets.find((pet) => pet.id === "P-1002").name);
assert.equal(reservationDetail.serviceDurationMinutes, 90);
assert.equal(reservationDetail.endTime, "13:00");
assert.equal(reservationDetail.staffLabel, "담당자 미지정");
assert.equal(buildAppointmentDetailViewModel(ownerBootstrapMock, "missing-appointment"), null);

const customers = buildCustomerSummaries(ownerBootstrapMock);
assert.deepEqual(provider.getCustomerSummaries(), customers);
assert.equal(customers.length, ownerBootstrapMock.guardians.length);
const customerSummary = customers.find((customer) => customer.id === "G-1002");
assert.ok(customerSummary, "customer summary should resolve guardian G-1002");
assert.deepEqual(customerSummary.petNames, [
  ownerBootstrapMock.pets.find((pet) => pet.id === "P-1002").name,
  ownerBootstrapMock.pets.find((pet) => pet.id === "P-1003").name,
]);
assert.equal(customerSummary.latestVisitLabel, "4/28");
assert.match(customerSummary.nextBookingLabel, /11:30/);
assert.ok(customerSummary.tags.length > 0, "customer tags should remain calculated placeholders");

const customerDetail = buildCustomerDetailViewModel(ownerBootstrapMock, "G-1002");
assert.deepEqual(provider.getCustomerDetail("G-1002"), customerDetail);
assert.ok(customerDetail, "customer detail should resolve by guardianId");
assert.equal(customerDetail.id, "G-1002");
assert.equal(customerDetail.pets.length, 2);
assert.equal(customerDetail.appointments.length, 2);
assert.equal(customerDetail.groomingRecords.length, 1);
assert.equal(customerDetail.notifications.length, 1);
assert.equal(buildCustomerDetailViewModel(ownerBootstrapMock, "missing-guardian"), null);

const settings = buildSettingsSummaryViewModel(ownerBootstrapMock);
assert.deepEqual(provider.getSettingsSummary(), settings);
assert.deepEqual(provider.getShopSummary(), settings.shop);
assert.equal(settings.shop.id, ownerBootstrapMock.shop.id);
assert.equal(settings.accountEmail, ownerBootstrapMock.ownerProfile.email);
assert.match(settings.businessHoursSummary, /10:00 - 19:00/);
assert.match(settings.bookingPolicySummary, /2/);
assert.match(settings.serviceSummary, /4/);
assert.deepEqual(
  settings.rows.map((row) => row.key),
  ["shop", "hours", "policy", "alerts", "services", "billing"],
);

assert.equal(getAppointmentStatusLabel("pending"), "승인 대기");
assert.equal(getAppointmentStatusLabel("confirmed"), "확정");
assert.equal(getAppointmentStatusLabel("in_progress"), "진행 중");
assert.equal(getAppointmentStatusLabel("almost_done"), "픽업 준비");
assert.equal(getAppointmentStatusLabel("completed"), "완료");
assert.equal(getAppointmentStatusLabel("cancelled"), "취소");
assert.equal(getAppointmentStatusLabel("rejected"), "거절");
assert.equal(getAppointmentStatusLabel("noshow"), "노쇼");
assert.equal(getAppointmentStatusSection("confirmed"), "active");
assert.equal(getAppointmentStatusSection("cancelled"), "cancelChange");
assert.equal(isActiveAppointmentStatus("in_progress"), true);
assert.equal(isActiveAppointmentStatus("completed"), false);
assert.equal(rows.find((row) => row.id === "R-2403").sourceLabel, getAppointmentSourceLabel("owner"));
assert.equal(rows.find((row) => row.id === "R-2401").sourceLabel, getAppointmentSourceLabel("customer"));
assert.notEqual(getAppointmentSourceLabel("owner"), getAppointmentSourceLabel("customer"));

console.log("ViewModel checks passed");
