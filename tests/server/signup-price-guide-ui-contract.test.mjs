import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { findPriceGuideV2ClassificationIssues } from "../../src/types/price-guide-photo-import.ts";
import { shouldBypassSignupPhoneVerification } from "../../src/lib/auth/signup-local-phone-bypass.ts";
import { buildDemoBootstrap, buildDemoInitialSetupBootstrap } from "../../src/lib/mock-data.ts";
import { isConfirmedPriceGuideDuration } from "../../src/lib/price-guide-duration-confirmation.ts";

const pricingStepPath = new URL("../../src/components/auth/signup-service-pricing-step.tsx", import.meta.url);
const editorPath = new URL("../../src/components/auth/signup-price-guide-editor.tsx", import.meta.url);
const signupFormPath = new URL("../../src/components/auth/signup-form.tsx", import.meta.url);
const signupViewPath = new URL("../../src/components/auth/signup-redesign-view.tsx", import.meta.url);
const previewPath = new URL("../../src/app/dev/signup-and-initial-setup-preview/signup-and-initial-setup-preview-client.tsx", import.meta.url);
const initialSetupGuidePath = new URL("../../src/components/owner-web/owner-initial-setup-guide.tsx", import.meta.url);
const initialSetupBlockingModalPath = new URL("../../src/components/owner-web/owner-initial-setup-blocking-modal.tsx", import.meta.url);
const initialSetupPreviewPath = new URL("../../src/app/dev/initial-setup-guide-preview/initial-setup-guide-preview-client.tsx", import.meta.url);
const initialSetupFixtureFormPath = new URL("../../src/app/dev/initial-setup-guide-preview/initial-setup-fixture-form.tsx", import.meta.url);
const initialSetupStaffPanelPath = new URL("../../src/components/owner-web/initial-setup-staff-management-panel.tsx", import.meta.url);
const demoOwnerPagePath = new URL("../../src/app/demo/owner-web/page.tsx", import.meta.url);
const demoLayoutPath = new URL("../../src/app/demo/layout.tsx", import.meta.url);
const proxyPath = new URL("../../src/proxy.ts", import.meta.url);
const ownerPreviewPath = new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url);
const ownerShellPath = new URL("../../src/components/owner-web/owner-web-app-shell.tsx", import.meta.url);
const settingsManagementPath = new URL("../../src/components/owner-web/settings-management-screen.tsx", import.meta.url);
const shopInfoSettingsPath = new URL("../../src/components/owner-web/settings-shop-info-panel.tsx", import.meta.url);
const operatingHoursPath = new URL("../../src/components/owner-web/operating-hours-settings.tsx", import.meta.url);
const staffManagementPath = new URL("../../src/components/owner-web/staff-management-screen.tsx", import.meta.url);
const serviceManagementPath = new URL("../../src/components/owner-web/service-management-screen.tsx", import.meta.url);
const bookingReadinessPath = new URL("../../src/components/owner-web/owner-booking-readiness-screen.tsx", import.meta.url);
const customerPhonePreviewPath = new URL("../../src/components/owner-web/customer-page-phone-preview.tsx", import.meta.url);
const bookingLinkPath = new URL("../../src/components/owner-web/booking-link-management-screen.tsx", import.meta.url);
const customerBookingPath = new URL("../../src/components/customer/customer-booking-page.tsx", import.meta.url);
const onboardingChoicePath = new URL("../../src/components/owner-web/price-guide-onboarding-choice.tsx", import.meta.url);
const manualOnboardingPath = new URL("../../src/components/owner-web/price-guide-manual-onboarding.tsx", import.meta.url);
const directInlineMatrixPath = new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url);
const photoOnboardingPath = new URL("../../src/components/owner-web/price-guide-photo-onboarding.tsx", import.meta.url);
const priceGuideV2DetailPath = new URL("../../src/components/owner-web/price-guide-v2-service-detail.tsx", import.meta.url);
const signupRoutePath = new URL("../../src/app/api/auth/signup/route.ts", import.meta.url);
const signupValidationPath = new URL("../../src/server/signup-price-guide-validation.ts", import.meta.url);
const emptyServicesMigrationPath = new URL("../../supabase/migrations/20260830090000_allow_empty_owner_signup_services.sql", import.meta.url);
const atomicSignupV5MigrationPath = new URL("../../supabase/migrations/20260829023403_harden_atomic_owner_signup.sql", import.meta.url);
const reusedPhoneV4MigrationPath = new URL("../../supabase/migrations/20260827064926_reused_phone_single_trial_signup.sql", import.meta.url);

test("signup phone verification bypass is restricted to non-production 127.0.0.1 UI testing", async () => {
  assert.equal(
    shouldBypassSignupPhoneVerification({ nodeEnv: "development", hostname: "127.0.0.1" }),
    true,
  );
  assert.equal(
    shouldBypassSignupPhoneVerification({ nodeEnv: "production", hostname: "127.0.0.1" }),
    false,
  );
  for (const hostname of ["localhost", "192.168.0.20", "petmanager.co.kr", "preview.petmanager.co.kr"]) {
    assert.equal(
      shouldBypassSignupPhoneVerification({ nodeEnv: "development", hostname }),
      false,
      `hostname=${hostname}`,
    );
  }

  const form = await readFile(signupFormPath, "utf8");
  const continueAccountStart = form.indexOf("const continueAccount = () => {");
  const startKcpStart = form.indexOf("const startKcpVerification = async () => {");
  assert.ok(continueAccountStart >= 0 && startKcpStart > continueAccountStart);
  const continueAccount = form.slice(continueAccountStart, startKcpStart);
  const bypassGuard = continueAccount.indexOf("shouldBypassSignupPhoneVerification");
  assert.ok(bypassGuard >= 0);
  for (const validation of [
    "isValidOwnerEmail(email)",
    'emailCheck.status !== "available"',
    "isValidOwnerPassword(fields.password)",
    "fields.password !== fields.passwordConfirm",
  ]) {
    const validationIndex = continueAccount.indexOf(validation);
    assert.ok(validationIndex >= 0 && validationIndex < bypassGuard, `${validation} must run before the bypass guard`);
  }
  assert.match(
    continueAccount,
    /nodeEnv: process\.env\.NODE_ENV,[\s\S]*hostname: window\.location\.hostname,[\s\S]*setLocalPhoneVerificationBypassed\(true\);[\s\S]*setStage\("shop"\);[\s\S]*return;[\s\S]*setLocalPhoneVerificationBypassed\(false\);[\s\S]*void startKcpVerification\(\);/,
  );
  assert.doesNotMatch(continueAccount, /setVerificationToken|identityVerificationId|verificationRequestId/);

  const submitSignupStart = form.indexOf("const submitSignup = async () => {");
  const renderStart = form.indexOf("\n  return (", submitSignupStart);
  assert.ok(submitSignupStart >= 0 && renderStart > submitSignupStart);
  const submitSignup = form.slice(submitSignupStart, renderStart);
  const localCompletionStart = submitSignup.indexOf("if (localPhoneVerificationBypassed)");
  const verificationGuardStart = submitSignup.indexOf("if (!verificationToken");
  const signupRequestStart = submitSignup.indexOf('fetch("/api/auth/signup"');
  assert.ok(localCompletionStart >= 0);
  for (const validation of [
    "fields.shopName.trim()",
    "isValidShopPhone(fields.shopPhone)",
    "fields.shopAddress.trim()",
  ]) {
    const validationIndex = submitSignup.indexOf(validation);
    assert.ok(validationIndex >= 0 && validationIndex < localCompletionStart, `${validation} must run before local completion`);
  }
  assert.ok(localCompletionStart < verificationGuardStart && verificationGuardStart < signupRequestStart);
  const localCompletionBranch = submitSignup.slice(localCompletionStart, verificationGuardStart);
  assert.match(form, /const LOCAL_SIGNUP_SETUP_PREVIEW_PATH = "\/demo\/owner-web\?initialSetup=1";/);
  assert.match(localCompletionBranch, /setCompletionDestinationPath\(LOCAL_SIGNUP_SETUP_PREVIEW_PATH\);[\s\S]*setStage\("complete"\);[\s\S]*return;/);
  assert.doesNotMatch(localCompletionBranch, /initialSetupPath|\/owner\?initialSetup=1|\/dev\/signup-and-initial-setup-preview/);
  assert.doesNotMatch(localCompletionBranch, /fetch\(|setSession|writeOwnerAuth|setVerificationToken/);
});

test("local signup completion opens the public DB-free owner setup while real signup keeps its authenticated destination", async () => {
  const [form, demoPage, demoLayout, proxy, ownerPreview, guide, settings, operatingHours, staff, staffPanel, services, bookingReadiness, phonePreview, bookingLink, customerBooking] = await Promise.all([
    readFile(signupFormPath, "utf8"),
    readFile(demoOwnerPagePath, "utf8"),
    readFile(demoLayoutPath, "utf8"),
    readFile(proxyPath, "utf8"),
    readFile(ownerPreviewPath, "utf8"),
    readFile(initialSetupGuidePath, "utf8"),
    readFile(settingsManagementPath, "utf8"),
    readFile(operatingHoursPath, "utf8"),
    readFile(staffManagementPath, "utf8"),
    readFile(initialSetupStaffPanelPath, "utf8"),
    readFile(serviceManagementPath, "utf8"),
    readFile(bookingReadinessPath, "utf8"),
    readFile(customerPhonePreviewPath, "utf8"),
    readFile(bookingLinkPath, "utf8"),
    readFile(customerBookingPath, "utf8"),
  ]);

  const signupRequestStart = form.indexOf('fetch("/api/auth/signup"');
  const renderStart = form.indexOf("\n  return (", signupRequestStart);
  assert.ok(signupRequestStart >= 0 && renderStart > signupRequestStart);
  const realSignupCompletion = form.slice(signupRequestStart, renderStart);
  assert.match(realSignupCompletion, /const destinationPath = result\.billingRequired \? "\/owner\/billing\?notice=trial-used" : initialSetupPath;/);
  assert.match(realSignupCompletion, /let completionPath = destinationPath;[\s\S]*await supabase\?\.auth\.setSession[\s\S]*completionPath = `\/login\?next=[\s\S]*setCompletionDestinationPath\(completionPath\);/);
  assert.doesNotMatch(realSignupCompletion, /LOCAL_SIGNUP_SETUP_PREVIEW_PATH|\/demo\/owner-web/);

  assert.match(demoPage, /import OwnerWebPreview from "@\/components\/owner-web\/owner-web-preview";/);
  assert.match(demoPage, /import \{ buildDemoBootstrap, buildDemoInitialSetupBootstrap \} from "@\/lib\/mock-data";/);
  assert.match(demoPage, /const initialSetup = \(await searchParams\)\.initialSetup;/);
  assert.match(demoPage, /initialSetup === "1"[\s\S]*\? buildDemoInitialSetupBootstrap\(\)[\s\S]*: buildDemoBootstrap\(\)/);
  assert.match(demoPage, /<OwnerWebPreview initialData=\{initialData\} \/>/);
  assert.doesNotMatch(demoPage, /getBootstrap|getServerSessionUser|redirect\(|fetchApiJson|supabase/i);
  assert.match(demoLayout, /return children;/);
  assert.doesNotMatch(demoLayout, /getServerSessionUser|redirect\(|supabase|auth/i);
  assert.match(proxy, /request\.nextUrl\.pathname !== "\/owner"/);
  assert.match(proxy, /matcher: \["\/owner"\]/);
  assert.doesNotMatch(proxy, /demo\/owner-web/);

  const completedDemo = buildDemoBootstrap();
  const initialSetupDemo = buildDemoInitialSetupBootstrap();
  assert.equal(completedDemo.initialSetupReadiness?.completed, true);
  assert.deepEqual(initialSetupDemo.initialSetupReadiness, {
    shopId: "demo-shop",
    steps: { hours: false, staff: false, pricing: false },
    completed: false,
    nextStep: "hours",
  });
  assert.equal(initialSetupDemo.services.length, 0);
  assert.equal(initialSetupDemo.staffMembers.length, 1);
  assert.deepEqual(initialSetupDemo.staffMembers[0]?.defaultDays, []);
  assert.equal(
    Object.values(initialSetupDemo.shop.business_hours).some((hours) => hours?.enabled),
    false,
  );

  assert.match(ownerPreview, /const \[activeScreen, setActiveScreen\] = useState<OwnerWebScreenKey>\(\(\) => getInitialOwnerWebScreen\(initialData\)\);/);
  assert.match(ownerPreview, /const \[initialSetupScreen, setInitialSetupScreen\] = useState<OwnerWebScreenKey>\("operatingHours"\);/);
  assert.match(ownerPreview, /const \[initialSetupOpen, setInitialSetupOpen\] = useState\(false\);/);
  assert.doesNotMatch(ownerPreview, /useState\([^;]*window\.|useState[^;]*localStorage/);
  assert.match(ownerPreview, /const requestedAfterSignup = new URLSearchParams\(window\.location\.search\)\.get\("initialSetup"\) === "1";[\s\S]*const visibility = resolveOwnerInitialSetupVisibility\(initialSetupReadiness, requestedAfterSignup\);[\s\S]*setInitialSetupOpen\(false\);[\s\S]*setInitialSetupScreen\(screenForInitialSetupStep\(visibility\.nextStep\)\)/);
  assert.match(ownerPreview, /const initialSetupEligible = !initialSetupReadiness\.completed;[\s\S]*showInitialSetupAction=\{initialSetupEligible\}/);
  for (const component of ["OwnerWebAppShell", "SettingsManagementScreen", "StaffManagementScreen", "ServiceManagementScreen", "OwnerInitialSetupGuide"]) {
    assert.match(ownerPreview, new RegExp(component));
  }
  assert.match(ownerPreview, /\{initialSetupOpen \? \([\s\S]*<OwnerInitialSetupGuide[\s\S]*open[\s\S]*activeScreen=\{initialSetupScreen\}[\s\S]*onNavigate=\{setInitialSetupScreen\}/);
  assert.match(ownerPreview, /persistShopProfile=\{!isDemoOwnerWebData\(initialData\)\}/);
  assert.match(ownerPreview, /demoMode=\{isDemoOwnerWebData\(initialData\)\}/);
  for (const setupScreen of ['screen: "operatingHours"', 'screen: "staff"', 'screen: "services"']) {
    assert.ok(guide.includes(setupScreen));
  }
  assert.doesNotMatch(guide + "\n" + ownerPreview, /bookingTest|OwnerBookingReadinessScreen|예약 페이지 미리보기·테스트 예약/);
  assert.doesNotMatch(phonePreview, /fetch\(|fetchApiJson|supabase|auth\.|payment|billing/i);
  assert.match(ownerPreview, /case "bookingLink":[\s\S]*<BookingLinkManagementScreen initialData=\{initialData\} \/>/);
  assert.match(bookingLink, /return `\$\{window\.location\.origin\}\/s\/\$\{shopId\}`/);
  assert.match(bookingLink, /href=\{bookingUrl\}[\s\S]*고객 화면 열기/);
  assert.match(phonePreview, /<CustomerBookingPage[\s\S]*previewOnly[\s\S]*onPreviewBookingComplete=\{onTestReservationComplete\}/);
  assert.match(customerBooking, /if \(previewOnly\) \{[\s\S]*onPreviewBookingComplete\?\.\(\);[\s\S]*setFirstVisitStep\(5\);[\s\S]*return;[\s\S]*fetchJson<BookingCreateResponse>\("\/api\/customer-bookings"/);

  const profitabilityWarmupStart = ownerPreview.indexOf("const warmProfitability = () => {");
  const profitabilityEffectStart = ownerPreview.lastIndexOf("useEffect(() => {", profitabilityWarmupStart);
  const profitabilityEffectEnd = ownerPreview.indexOf("\n  useEffect(() => {", profitabilityWarmupStart);
  assert.ok(profitabilityEffectStart >= 0 && profitabilityEffectEnd > profitabilityWarmupStart);
  const profitabilityEffect = ownerPreview.slice(profitabilityEffectStart, profitabilityEffectEnd);
  assert.match(profitabilityEffect, /if \(demoMode \|\| initialSetupEligible\) return;[\s\S]*fetchApiJsonWithAuth\(`\/api\/owner\/profitability/);

  const staffSaveStart = ownerPreview.indexOf("async function handleStaffMembersChange");
  const staffSaveEnd = ownerPreview.indexOf("\n  function handleScreenSelect", staffSaveStart);
  const staffSave = ownerPreview.slice(staffSaveStart, staffSaveEnd);
  assert.match(staffSave, /if \(demoMode\) \{[\s\S]*withDemoInitialSetupReadiness\([\s\S]*staffMembers: nextStaff[\s\S]*window\.localStorage\.setItem[\s\S]*return;[\s\S]*fetchApiJsonWithAuth/);
  assert.match(staff, /function updateInitialSetupDraft[\s\S]*const nextDraft = \{ \.\.\.draft, \.\.\.patch \};[\s\S]*syncInitialSetupSession\(nextDraft, initialSetupPhoto, "dirty"\)/);
  assert.doesNotMatch(staff, /setDraft\(\(current\) => \{[\s\S]*syncInitialSetupSession/);

  const logoutStart = ownerPreview.indexOf("async function handleLogout");
  const logoutEnd = ownerPreview.indexOf("\n  return (", logoutStart);
  const logout = ownerPreview.slice(logoutStart, logoutEnd);
  assert.match(logout, /if \(demoMode\) \{[\s\S]*window\.location\.href = "\/login";[\s\S]*return;[\s\S]*getSupabaseBrowserClient\(\)/);

  assert.match(operatingHours, /if \(!persistToSupabase \|\| nextShop\.id === "demo-shop" \|\| nextShop\.id === "owner-demo"\) \{[\s\S]*onSaveSuccess\?\.\(\);[\s\S]*return;[\s\S]*fetchApiJsonWithAuth<Shop>\("\/api\/settings"/);
  assert.match(operatingHours, /notifySuccess = !initialSetupMode[\s\S]*if \(notifySuccess\) onSaveSuccess\?\.\(\)/);
  assert.match(operatingHours, /<OwnerInitialSetupSaveNextActions[\s\S]*onSave=\{completeInitialSetupStep\}[\s\S]*onNext=\{\(\) => onInitialSetupNext\?\.\(\)\}/);
  assert.match(settings, /if \(!persistShopProfile\) \{[\s\S]*onShopChange\?\.\(optimisticShop\);[\s\S]*return;[\s\S]*fetchApiJsonWithAuth/);
  assert.equal((staff.match(/if \(shopId && !isDemoShop\)/g) ?? []).length, 3);
  assert.equal((staff.match(/"\/api\/staff-schedule-overrides"/g) ?? []).length, 3);
  assert.match(services, /if \(demoMode\) \{[\s\S]*onServicesChange\?\.\([\s\S]*return true;[\s\S]*fetchApiJsonWithAuth<Service>\("\/api\/services"/);
  assert.match(services, /if \(demoMode \|\| shop\.id === "demo-shop" \|\| shop\.id === "owner-demo"\) \{[\s\S]*return;[\s\S]*fetchApiJsonWithAuth/);
  assert.doesNotMatch(guide, /localStorage|getOwnerInitialSetupGuideStorageKey|dismissedAt/);
  assert.match(ownerPreview, /fetchApiJsonWithAuth<BootstrapPayload>\([\s\S]*\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(shopId\)\}&phase=essential[\s\S]*\{ cache: "no-store" \}/);
  assert.match(staff, /if \(initialSetupMode\) \{[\s\S]*<InitialSetupStaffManagementPanel[\s\S]*onSave=\{\(\) => void saveInitialSetupStaff\(\)\}[\s\S]*onNext=\{\(\) => onInitialSetupNext\?\.\(\)\}/);
  assert.match(staffPanel, /<OwnerInitialSetupSaveNextActions onSave=\{onSave\} onNext=\{onNext\} saving=\{isSaving\} \/>/);
  assert.doesNotMatch(staffPanel, /저장하고 다음/);
  assert.match(ownerPreview, /<StaffManagementScreen[\s\S]*initialSetupMode=\{initialSetupMode\}[\s\S]*onInitialSetupNext=\{onInitialSetupStaffNext\}/);
});

test("signup skips final review and opens a completion page before the existing destination", async () => {
  const [form, view, route, validation] = await Promise.all([
    readFile(signupFormPath, "utf8"),
    readFile(signupViewPath, "utf8"),
    readFile(signupRoutePath, "utf8"),
    readFile(signupValidationPath, "utf8"),
  ]);
  assert.doesNotMatch(form, /SignupServicePricingStep|priceGuideDocument/);
  assert.doesNotMatch(form, /servicePrices\s*:/);
  assert.match(form, /type SignupStage = SignupProfileStage \| "complete";/);
  assert.doesNotMatch(form, /SignupReviewStep|stage === "review"|setStage\("review"\)|SignupProfileStage \| "review"/);
  assert.match(form, /initialSetupPath = `\$\{nextPath\}[\s\S]*initialSetup=1`/);
  assert.match(form, /result\.billingRequired \? "\/owner\/billing\?notice=trial-used" : initialSetupPath/);
  assert.match(form, /let completionPath = destinationPath;[\s\S]*await supabase\?\.auth\.setSession[\s\S]*completionPath = `\/login\?next=[\s\S]*setCompletionDestinationPath\(completionPath\);\s*setStage\("complete"\);/);
  assert.match(form, /const continueAccount[\s\S]*shouldBypassSignupPhoneVerification[\s\S]*setStage\("shop"\)[\s\S]*void startKcpVerification\(\);\s*};[\s\S]*const startKcpVerification/);
  assert.match(form, /const startKcpVerification[\s\S]*setVerificationToken[\s\S]*setStage\("shop"\)/);
  assert.match(form, /else if \(stage === "account"\) \{\s*setStage\("terms"\);\s*} else \{\s*setStage\("account"\);/);
  assert.doesNotMatch(form, /setStage\("identity"\)|stage === "identity"|identityVerified=|onVerifyIdentity=|onContinueIdentity=/);
  assert.match(form, /onStart=\{\(\) => \{[\s\S]*if \(!completionDestinationPath\) return;[\s\S]*router\.replace\(completionDestinationPath as never\);[\s\S]*router\.refresh\(\);/);
  assert.match(form, /localPreview=\{localPhoneVerificationBypassed\}/);

  const signupRequestStart = form.indexOf('fetch("/api/auth/signup"');
  const failedResponseStart = form.indexOf("if (!response.ok || !result.success)", signupRequestStart);
  const successfulCompletionStart = form.indexOf('setStage("complete");', failedResponseStart);
  assert.ok(signupRequestStart >= 0 && failedResponseStart > signupRequestStart && successfulCompletionStart > failedResponseStart);
  assert.match(form.slice(failedResponseStart, successfulCompletionStart), /setMessage\([\s\S]*return;/);

  assert.match(view, /export type SignupProfileStage = "terms" \| "account" \| "shop";/);
  assert.match(view, /stage: SignupProfileStage \| "complete";/);
  assert.match(view, /if \(stage === "account"\)[\s\S]*onClick=\{onNextAccount\}[\s\S]*>\s*휴대폰으로 본인 인증하기\s*<\/button>/);
  assert.match(view, /<SignupShell title="매장 정보" onBack=\{onBack\}>[\s\S]*onClick=\{onSubmit\}[\s\S]*>\s*가입 완료하기\s*<\/button>/);
  assert.doesNotMatch(view, /stage === "identity"|title="휴대폰 인증"|identityVerified|onVerifyIdentity|onContinueIdentity/);

  const completeStageStart = view.indexOf('if (stage === "complete") {');
  const termsStageStart = view.indexOf('if (stage === "terms") {', completeStageStart);
  assert.ok(completeStageStart >= 0 && termsStageStart > completeStageStart);
  const completeStage = view.slice(completeStageStart, termsStageStart);
  assert.match(completeStage, /text-\[28px\][^"\n]*font-semibold[^"\n]*leading-9[\s\S]*가입이 완료되었습니다/);
  assert.match(completeStage, /text-\[16px\][^"\n]*font-normal[^"\n]*leading-6[\s\S]*이제 펫매니저를 시작할 준비가 되었어요\./);
  assert.match(completeStage, /가입 확인서[\s\S]*rounded-\[10px\][^"\n]*text-\[12px\][^"\n]*font-medium[^"\n]*leading-\[18px\][\s\S]*완료[\s\S]*h-px bg-\[#dbe2ea\]/);
  assert.equal((completeStage.match(/<dt /g) ?? []).length, 4);
  assert.equal((completeStage.match(/className=\{CONFIRMATION_ROW_CLASS\}/g) ?? []).length, 4);
  assert.equal((completeStage.match(/className=\{CONFIRMATION_LABEL_CLASS\}/g) ?? []).length, 4);
  assert.equal((completeStage.match(/className=\{CONFIRMATION_VALUE_CLASS\}/g) ?? []).length, 4);
  assert.match(view, /const CONFIRMATION_ROW_CLASS =\s*\n\s*"grid min-w-0 grid-cols-\[88px_minmax\(0,1fr\)\] items-start gap-4 py-3\.5";/);
  assert.match(view, /const CONFIRMATION_LABEL_CLASS =\s*\n\s*"text-\[14px\] font-medium leading-5 tracking-\[-0\.005em\] text-\[#64748b\]";/);
  assert.match(view, /const CONFIRMATION_VALUE_CLASS =\s*\n\s*"min-w-0 break-words text-right text-\[16px\] font-medium leading-6 text-\[#15213b\] tabular-nums \[overflow-wrap:anywhere\]";/);
  assert.match(completeStage, /<dl className="divide-y divide-\[#dbe2ea\] px-5 sm:px-6">/);
  for (const row of ["매장", "계정", "가입 상태", "다음 단계"]) assert.match(completeStage, new RegExp(`>${row}<`));
  assert.match(completeStage, /\{fields\.shopName\}/);
  assert.match(completeStage, /\{maskEmail\(fields\.email\)\}/);
  assert.doesNotMatch(completeStage, /\{fields\.email\}/);
  assert.match(completeStage, /가입 완료[\s\S]*영업시간 설정/);
  assert.match(completeStage, /<dd className=\{CONFIRMATION_VALUE_CLASS\}>\s*가입 완료\s*<\/dd>/);
  assert.match(completeStage, /<dd className=\{CONFIRMATION_VALUE_CLASS\}>\s*영업시간 설정\s*<\/dd>/);
  assert.match(completeStage, /영업시간부터 차례로 설정하면 바로 예약 관리를 시작할 수 있어요\./);
  assert.doesNotMatch(completeStage, /shopPhone|shopAddress|phoneNumber|password|birthDate|verificationToken|주소|전화번호|비밀번호|인증정보/);
  assert.match(completeStage, /localPreview \? \([\s\S]*text-\[12px\][^"\n]*font-normal[^"\n]*leading-\[18px\][\s\S]*PC 로컬 화면 테스트에서는 실제 계정이 생성되지 않습니다\./);
  assert.match(completeStage, /overflow-x-hidden[\s\S]*max-w-\[448px\]/);
  assert.doesNotMatch(completeStage, /min-w-\[|whitespace-nowrap|overflow-x-auto/);
  assert.equal((completeStage.match(/bg-white/g) ?? []).length, 1);
  assert.equal((completeStage.match(/<button type="button"/g) ?? []).length, 1);
  assert.match(view, /CONFIRMATION_VALUE_CLASS[\s\S]*tabular-nums/);
  assert.doesNotMatch(completeStage, /shadow-|yellow|amber|#b98121/i);
  assert.match(view, /function maskEmail\(value: string\)[\s\S]*"\*"\.repeat\(Math\.max\(3,[\s\S]*return `\$\{visibleLocalPart\}\$\{maskedLocalPart\}@\$\{domain\}`;/);
  assert.match(view, /const PRIMARY_BUTTON_CLASS =[\s\S]*h-\[62px\][^"\n]*rounded-\[14px\][^"\n]*font-medium/);
  assert.match(completeStage, /펫매니저 시작하기/);
  assert.doesNotMatch(completeStage, /onBack|이전 단계|FINAL REVIEW|개인정보|매장 기본정보|확인하고 가입 완료/);
  assert.doesNotMatch(completeStage, /font-(?:bold|extrabold|black)|font-\[(?:[7-9]00)\]/);
  assert.match(validation, /servicePrices:\s*z\.array\(signupServicePriceSchema\)\.max\(80\)\.optional\(\)/);
  assert.match(validation, /servicePrices:\s*z\.array\(signupServicePriceSchema\)\.max\(80\)\.parse\(parsed\.servicePrices \?\? \[\]\)/);
  assert.match(validation, /payload\.servicePrices\.length === 0\s*\? \[\]/);
  assert.doesNotMatch(route, /^export\s+(?:type|interface|class|const|function)\s+/m);
});

test("owner setup exposes only the three actionable setup items and advances from save results", async () => {
  const [guide, ownerPreview, staff, staffPanel, services] = await Promise.all([
    readFile(initialSetupGuidePath, "utf8"),
    readFile(ownerPreviewPath, "utf8"),
    readFile(staffManagementPath, "utf8"),
    readFile(initialSetupStaffPanelPath, "utf8"),
    readFile(serviceManagementPath, "utf8"),
  ]);

  for (const label of ["영업시간", "직원 관리", "서비스·가격"]) {
    assert.match(guide, new RegExp(label));
  }
  assert.doesNotMatch(guide, /bookingTest|예약 페이지 미리보기|테스트 예약|필수 약관 동의|계정 정보 입력|오너 본인인증|매장 기본정보 입력|\{completedCount\}\s*\/|progressbar/);
  assert.ok(guide.indexOf("영업시간") < guide.indexOf("직원 관리"));
  assert.ok(guide.indexOf("직원 관리") < guide.indexOf("서비스·가격"));
  assert.match(guide, /const confirmed = OWNER_INITIAL_SETUP_ORDER\.filter\(\(step\) => readiness\.steps\[step\]\)/);
  assert.match(guide, /const allComplete = readiness\.completed/);
  assert.match(guide, /if \(!open \|\| !portalTarget \|\| allComplete\) return null/);
  assert.match(guide, /data-testid="owner-initial-setup-title-group"[\s\S]*?aria-label="이전 단계로"[\s\S]*?<ChevronLeft[^>]*aria-hidden="true"[\s\S]*?\{activeItem\.label\}/);
  assert.match(guide, /className="inline-flex h-11 w-11[^"\n]*focus-visible:ring-2[^"\n]*"\s*aria-label="이전 단계로"/);
  assert.doesNotMatch(guide, />\s*이전\s*</);
  assert.match(guide, /나중에 하기/);
  assert.doesNotMatch(guide, /localStorage|sessionStorage|dismissedAt/);
  assert.doesNotMatch(guide, /SetupRows|item\.description|다음 단계|계속하기|컨페티|confetti|gradient|font-(?:bold|extrabold|black)|font-\[(?:[7-9]00)\]/i);
  const setupSaveStart = ownerPreview.indexOf("function handleInitialSetupStepSaved");
  const setupSaveEnd = ownerPreview.indexOf("\n  function handleInitialSetupHoursNext", setupSaveStart);
  const setupSaveHandler = ownerPreview.slice(setupSaveStart, setupSaveEnd);
  assert.match(setupSaveHandler, /canonicalBootstrap[\s\S]*refreshInitialSetupReadiness\(\)[\s\S]*getBootstrapOwnerInitialSetupReadiness\(refreshed\)[\s\S]*readiness\.steps\[step\]/);
  assert.doesNotMatch(setupSaveHandler, /setInitialSetupScreen/);
  assert.match(ownerPreview, /function handleInitialSetupHoursNext\(\) \{[\s\S]*steps\.hours[\s\S]*setInitialSetupScreen\("staff"\)/);
  assert.match(ownerPreview, /setInitialSetupStaffSessionDraft,[\s\S]*handleInitialSetupStaffNext,[\s\S]*handleInitialSetupPricingNext,/);
  assert.match(staff, /onSave=\{\(\) => void saveInitialSetupStaff\(\)\}[\s\S]*onNext=\{\(\) => onInitialSetupNext\?\.\(\)\}/);
  assert.match(staffPanel, /<OwnerInitialSetupSaveNextActions onSave=\{onSave\} onNext=\{onNext\} saving=\{isSaving\} \/>/);
  assert.match(ownerPreview, /onInitialSetupNext=\{onInitialSetupStaffNext\}/);
  assert.match(ownerPreview, /handleInitialSetupHoursNext,[\s\S]*setInitialSetupStaffSessionDraft,[\s\S]*handleInitialSetupStaffNext,[\s\S]*handleInitialSetupPricingNext,/);
  assert.match(services, /if \(saved && hasValidDetailedRow\) onPriceGuideSaveSuccess\?\.\(lastCanonicalBootstrapRef\.current \?\? undefined\)/);
  assert.match(services, /const saved = await saveService\(\{[\s\S]*showError: false,[\s\S]*formToSave: nextForm,[\s\S]*refetchCanonicalAfterSave: true,[\s\S]*\}\);[\s\S]*if \(saved && hasValidDetailedRow\) onPriceGuideSaveSuccess\?\.\(lastCanonicalBootstrapRef\.current \?\? undefined\)/);
});

test("owner setup uses an accessible guide and a non-dismissible blocking modal over inert operations", async () => {
  const [guide, blockingModal, ownerPreview, ownerShell, bookingReadiness, operatingHours, staff, staffPanel, services, shopInfoSettings] = await Promise.all([
    readFile(initialSetupGuidePath, "utf8"),
    readFile(initialSetupBlockingModalPath, "utf8"),
    readFile(ownerPreviewPath, "utf8"),
    readFile(ownerShellPath, "utf8"),
    readFile(bookingReadinessPath, "utf8"),
    readFile(operatingHoursPath, "utf8"),
    readFile(staffManagementPath, "utf8"),
    readFile(initialSetupStaffPanelPath, "utf8"),
    readFile(serviceManagementPath, "utf8"),
    readFile(shopInfoSettingsPath, "utf8"),
  ]);
  assert.doesNotMatch(ownerPreview, /pm-initial-setup-layout|setupMode=\{initialSetupOpen\}/);
  assert.match(ownerShell, /inert=\{backgroundBlocked \? true : undefined\}[\s\S]*aria-hidden=\{backgroundBlocked \? true : undefined\}/);
  assert.match(ownerShell, /backgroundBlocked && "pointer-events-none select-none"/);
  assert.match(ownerPreview, /\{initialSetupOpen \? \([\s\S]*<OwnerInitialSetupGuide[\s\S]*\{renderScreen\([\s\S]*initialSetupScreen[\s\S]*true,/);
  assert.doesNotMatch(guide, /lg:sticky|aria-label="매장 준비 4단계"|SetupRows|item\.description/);
  assert.match(guide, /min-h-11/);
  assert.match(guide, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="owner-initial-setup-title"/);
  assert.match(guide, /pointer-events-none fixed inset-0 z-\[90\]/);
  assert.match(guide, /pointer-events-auto absolute inset-0 bg-\[#0f172a\]\/35[\s\S]*onPointerDown=\{closeGuide\}/);
  assert.match(guide, /pointer-events-none absolute inset-0[^"\n]*p-\[10px\][^"\n]*sm:p-6/);
  assert.match(guide, /pointer-events-auto relative z-10 flex max-h-/);
  assert.match(guide, /max-h-\[calc\(100dvh-20px\)\][^"\n]*rounded-\[18px\][^"\n]*sm:max-h-\[calc\(100dvh-48px\)\][^"\n]*sm:w-\[min\(960px,calc\(100vw-48px\)\)\]/);
  assert.match(guide, /OWNER_TYPOGRAPHY\.sectionTitle/);
  assert.match(guide, /data-testid="owner-initial-setup-body"/);
  assert.doesNotMatch(guide, /sticky bottom-0|<footer/);
  assert.match(guide, /document\.body\.style\.overflow = "hidden"/);
  assert.match(guide, /document\.documentElement\.style\.overflow = "hidden"/);
  assert.match(guide, /document\.body\.style\.overflow = previousBodyOverflow/);
  assert.match(guide, /document\.documentElement\.style\.overflow = previousDocumentOverflow/);
  assert.match(guide, /event\.key === "Escape"[\s\S]*closeGuide\(\)/);
  assert.match(guide, /if \(!open \|\| allComplete \|\| !portalTarget\) return;[\s\S]*dialogRef\.current\?\.focus\(\)/);
  assert.match(guide, /previouslyFocused\?\.focus\(\)/);
  assert.match(guide, /setPortalTarget\(document\.body\)/);
  assert.match(guide, /data-testid="owner-initial-setup-header-actions"/);
  assert.match(guide, /OwnerInitialSetupPrimaryAction[\s\S]*createPortal\(children, headerActionElement\)/);
  assert.match(guide, /railLabel: "영업시간"[\s\S]*railLabel: "직원 관리"[\s\S]*railLabel: "서비스·가격"/);
  assert.doesNotMatch(guide, /railLabel: "예약 확인"|bookingTest/);
  assert.match(guide, /setupItems\.map/);
  assert.match(guide, /aria-label="매장 준비 단계"/);
  assert.match(guide, /confirmed\.includes\(item\.key\)[\s\S]*disabled=\{!available\}[\s\S]*aria-label=\{complete \? `\$\{item\.railLabel\}, 설정 완료` : item\.railLabel\}/);
  assert.match(guide, /items-center justify-start[^"\n]*text-left/);
  assert.match(guide, /data-testid="owner-initial-setup-title-row"/);
  assert.match(guide, /className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2"/);
  assert.match(guide, /data-testid="owner-initial-setup-title-group"/);
  assert.match(guide, /className="flex min-w-0 flex-\[1_1_160px\] items-center gap-1"/);
  assert.match(guide, /data-testid="owner-initial-setup-title-actions"/);
  assert.match(guide, /max-w-full flex-\[0_1_auto\] flex-wrap/);
  assert.doesNotMatch(guide, /data-testid="owner-initial-setup-action-row"/);
  assert.match(guide, /className="mt-3 flex min-h-11 min-w-0 justify-end empty:hidden"/);
  assert.match(guide, /\{previousItem \? \([\s\S]*?onClick=\{\(\) => onNavigate\(previousItem\.screen\)\}[\s\S]*?aria-label="이전 단계로"[\s\S]*?\) : null\}/);
  assert.equal([...guide.matchAll(/whitespace-nowrap/g)].length >= 3, true);
  assert.match(guide, /id="owner-initial-setup-title"[\s\S]*?\[overflow-wrap:anywhere\][^"\n]*\[word-break:keep-all\]/);
  assert.doesNotMatch(guide, /grid-cols-\[minmax\(0,1fr\)_auto\]|absolute left-1\/2 top-1\/2|sm:absolute sm:right-\[164px\]|truncate/);
  assert.match(guide, /hidden w-\[184px\][^"\n]*md:block/);
  assert.doesNotMatch(ownerPreview + "\n" + shopInfoSettings, /aria-label="매장 준비 단계"/);
  assert.doesNotMatch(shopInfoSettings, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]|CustomerPagePhonePreview|<aside/);
  assert.doesNotMatch(guide + ownerPreview + blockingModal, /owner-initial-setup-resume-card|매장 준비 이어하기/);
  assert.match(blockingModal, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="owner-initial-setup-blocking-title"/);
  assert.match(blockingModal, />\s*중요\s*</);
  assert.match(blockingModal, />\s*매장 준비를 먼저 완료해 주세요\s*</);
  assert.match(blockingModal, /ref=\{primaryActionRef\}[\s\S]*min-h-12[\s\S]*>\s*초기 설정 이어하기\s*</);
  assert.doesNotMatch(blockingModal, /onClose|onPointerDown|<X\b/);
  assert.doesNotMatch(guide, /\{completedCount\}\/4/);
  assert.match(ownerPreview, /setActiveScreen\(getBootstrapOwnerInitialSetupReadiness\(ownerDataRef\.current\)\.completed \? "schedule" : "operatingHours"\);[\s\S]*searchParams\.delete\("initialSetup"\)/);
  assert.match(ownerPreview, /setupBlockingModalOpen=\{initialSetupEligible && !initialSetupOpen && activeScreen !== "ownerProfile" && activeScreen !== "help"\}/);
  assert.match(ownerPreview, /<div className="h-full min-h-0 min-w-0">[\s\S]*\{renderScreen\(/);
  assert.match(operatingHours, /initialSetupMode[\s\S]*grid-cols-\[minmax\(0,1fr\)_20px_minmax\(0,1fr\)\]/);
  assert.match(operatingHours, /initialSetupSubview[\s\S]*휴무일 추가[\s\S]*영업시간으로 돌아가기/);
  assert.match(operatingHours, /if \(initialSetupMode\) \{[\s\S]*addTemporaryHoliday\(dateKey\);[\s\S]*setPendingTemporaryHolidayDate\(dateKey\)/);
  assert.match(operatingHours, /!initialSetupMode && pendingTemporaryHolidayDate/);
  assert.match(staff, /hidePreview=\{initialSetupMode \|\| boardTab !== "list"\}/);
  const onboardingStaffStart = staff.lastIndexOf("if (initialSetupMode) {");
  const standardStaffStart = staff.indexOf("\n  return (", onboardingStaffStart);
  const onboardingStaff = staff.slice(onboardingStaffStart, standardStaffStart);
  assert.doesNotMatch(onboardingStaff, /StaffBoardTabs|StaffMonthlySchedule|todayBookings|weekBookings|annualRemain|연차|월간 근무표/);
  assert.match(onboardingStaff, /<InitialSetupStaffManagementPanel[\s\S]*selectedStaffId[\s\S]*onSave[\s\S]*onNext/);
  assert.match(staffPanel, /직원 목록[\s\S]*selectedStaffId[\s\S]*기본 근무 요일[\s\S]*출근 시간[\s\S]*퇴근 시간/);
  assert.doesNotMatch(bookingReadiness, /overflow-x-auto/);
});

test("service setup separates new-shop choice, inline direct matrix, photo review, and saved management", async () => {
  const [ownerPreview, services, choice, photo, manual, directMatrix, detail] = await Promise.all([
    readFile(ownerPreviewPath, "utf8"),
    readFile(serviceManagementPath, "utf8"),
    readFile(onboardingChoicePath, "utf8"),
    readFile(photoOnboardingPath, "utf8"),
    readFile(manualOnboardingPath, "utf8"),
    readFile(directInlineMatrixPath, "utf8"),
    readFile(priceGuideV2DetailPath, "utf8"),
  ]);
  assert.match(ownerPreview, /priceGuideOnboarding=\{initialSetupMode \|\| priceGuideOnboarding\}/);
  assert.match(services, /const initialManagedServices = useMemo\([\s\S]*normalizeBootstrapServices\(initialServices\)/);
  assert.match(services, /if \(rows\.length === 0\) return \[\];/);
  assert.match(services, /PriceGuidePhotoOnboarding/);
  assert.match(services, /if \(priceGuideOnboarding\) \{[\s\S]*data-testid="owner-initial-setup-services"/);
  assert.match(choice, /요금표 등록/);
  assert.match(choice, /사진으로 등록/);
  assert.match(choice, /기존 요금표 사진을 올려요\./);
  assert.match(choice, /직접 등록/);
  assert.match(choice, /서비스와 요금을 직접 입력해요\./);
  assert.match(choice, /min-h-24/);
  assert.match(choice, /sm:grid-cols-2/);
  assert.doesNotMatch(choice, /AI/);
  assert.match(photo, /mode === "choice" && !hasSavedPriceGuide \? <PriceGuideOnboardingChoice onSelect=\{selectMode\} \/>/);
  assert.doesNotMatch(photo, /default-draft|initialDocument \?\? createEmptyManualPriceGuideDocument\(\)/);
  assert.match(photo, /mode === "choice" && initialDocument \? \([\s\S]*<PriceGuideV2ServiceDetail[\s\S]*document=\{initialDocument\}[\s\S]*onSave=\{applyReviewedDocument\}[\s\S]*manualMatrixMode=\{isFixedManualPriceGuideDocument\(initialDocument\)\}[\s\S]*onSaveActionReady=\{onSaveActionReady\}/);
  assert.doesNotMatch(photo, /PriceGuideSavedServiceList|아직 등록된 서비스가 없습니다|서비스 추가/);
  assert.match(manual, /useState<PriceGuideV2>\(\(\) => initialDocument \?\? createEmptyManualPriceGuideDocument\(\)\)/);
  assert.match(manual, /manualMatrixMode \|\| photoEditing \? \([\s\S]*<PriceGuideNativeInlineTable[\s\S]*\) : \([\s\S]*<PriceGuideStructuredReviewTable/);
  assert.match(manual, /<PriceGuideStructuredReviewTable[\s\S]*document=\{draft\}[\s\S]*onEdit=/);
  assert.match(manual, /photoReviewMode=\{!manualMatrixMode\}/);
  assert.match(directMatrix, /data-price-guide-native-inline-table="true"/);
  assert.match(directMatrix, /<Plus className="h-4 w-4" aria-hidden="true" \/>체급/);
  assert.match(directMatrix, /addDirectPriceGuideWeightBand\(guide, groupIndex\)/);
  assert.match(directMatrix, /updateDirectPriceGuideWeightBand\(guide, groupIndex, weightIndex/);
  assert.match(directMatrix, /removeDirectPriceGuideWeightBand\(guide, groupIndex, weightIndex\)/);
  assert.match(directMatrix, /data-price-guide-weight-edit=\{weightIndex\}/);
  assert.match(directMatrix, /className=\{iconButtonClass\} aria-label=\{`\$\{groupName\} \$\{weightLabel\} 체급 삭제`\}/);
  assert.match(directMatrix, /const iconButtonClass = "inline-flex h-11 w-11/);
  assert.match(directMatrix, /<Plus className="h-4 w-4" aria-hidden="true" \/>항목/);
  assert.match(directMatrix, /<Plus className="h-4 w-4" aria-hidden="true" \/>그룹/);
  assert.doesNotMatch(directMatrix, /요금 행|이 그룹 편집|한 줄 메모로 초안 만들기/);
  assert.match(manual, /const saved = await onSave\(draft\)/);
  assert.match(detail, /data-price-guide-detail-matrix="true"[\s\S]*<PriceGuideNativeInlineTable/);
  assert.match(detail, /document=\{draft\}[\s\S]*onChange=\{updateDraft\}/);
  assert.match(detail, /onClick=\{\(\) => void saveDraft\(\)\}[\s\S]*상세 요금표 저장/);
  assert.doesNotMatch(detail, /MatrixGroupCard|EditableMatrixGroup|이 그룹 편집/);
  assert.match(services, /serviceId: nextService\.id[\s\S]*onServicesChange\?\.\(/);
  assert.match(services, /if \(demoMode\) \{[\s\S]*onServicesChange\?\.\(managedServicesToDomain[\s\S]*return true;[\s\S]*fetchApiJsonWithAuth<Service>\("\/api\/services"/);
  assert.match(services, /const saved = await saveService\(\{[\s\S]*showError: false,[\s\S]*formToSave: nextForm,[\s\S]*refetchCanonicalAfterSave: true,[\s\S]*\}\);[\s\S]*if \(saved && hasValidDetailedRow\) onPriceGuideSaveSuccess\?\.\(lastCanonicalBootstrapRef\.current \?\? undefined\)/);
  assert.match(services, /fetchApiJsonWithAuth<BootstrapPayload>[\s\S]*\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(shopId\)\}&phase=essential[\s\S]*\{ cache: "no-store" \}/);
  const onboardingStart = services.indexOf("if (priceGuideOnboarding) {");
  const onboardingEnd = services.indexOf("\n  const content =", onboardingStart);
  const onboarding = services.slice(onboardingStart, onboardingEnd);
  assert.match(onboarding, /initialSetupPriceGuideSaveAction \? \([\s\S]*<OwnerInitialSetupSaveNextActions[\s\S]*onSave=\{\(\) => initialSetupPriceGuideSaveAction\(\)\}[\s\S]*onNext=\{\(\) => runInitialSetupServiceNext\(onInitialSetupNext\)\}/);
  assert.doesNotMatch(onboarding, /onPriceGuideSaveSuccess|saveService|저장하고 다음/);
  assert.match(ownerPreview, /onPriceGuideSaveSuccess=\{\(canonicalBootstrap\) => onInitialSetupStepSaved\("pricing", canonicalBootstrap\)\}[\s\S]*onInitialSetupNext=\{onInitialSetupPricingNext\}/);
  assert.doesNotMatch(services, /font-(?:bold|extrabold|black)|font-\[(?:[7-9]00)\]/);
});

test("DB-free owner setup preview renders all three fixture forms and real save callbacks", async () => {
  const [preview, fixtureForm, staffPanel, choice, manual, directMatrix, editor] = await Promise.all([
    readFile(initialSetupPreviewPath, "utf8"),
    readFile(initialSetupFixtureFormPath, "utf8"),
    readFile(initialSetupStaffPanelPath, "utf8"),
    readFile(onboardingChoicePath, "utf8"),
    readFile(manualOnboardingPath, "utf8"),
    readFile(directInlineMatrixPath, "utf8"),
    readFile(editorPath, "utf8"),
  ]);

  assert.match(preview, /services:\s*\[\]/);
  const previewGuideStart = preview.indexOf("<OwnerInitialSetupGuide");
  const previewGuideEnd = preview.indexOf("</OwnerInitialSetupGuide>", previewGuideStart);
  const previewGuide = preview.slice(previewGuideStart, previewGuideEnd);
  assert.match(previewGuide, /<InitialSetupFixtureForm[\s\S]*activeScreen=\{activeScreen\}[\s\S]*onStepSaved=\{handleStepSaved\}[\s\S]*onHoursNext=\{\(\) => \{[\s\S]*setActiveScreen\("staff"\)/);
  assert.match(previewGuide, /onStaffNext=\{\(\) => \{[\s\S]*setActiveScreen\("services"\)/);
  assert.match(preview, /const steps = \{ \.\.\.current\.initialSetupReadiness!\.steps, \[step\]: true \};[\s\S]*const nextStep = OWNER_INITIAL_SETUP_ORDER\.find/);
  const previewSaveStart = preview.indexOf("function handleStepSaved");
  const previewSaveEnd = preview.indexOf("\n  return (", previewSaveStart);
  assert.doesNotMatch(preview.slice(previewSaveStart, previewSaveEnd), /setActiveScreen/);
  const staffSaveStart = preview.indexOf('if (step === "staff")');
  const staffSaveEnd = preview.indexOf("\n    setLastAction", staffSaveStart);
  const staffSaveBranch = preview.slice(staffSaveStart, staffSaveEnd);
  assert.match(staffSaveBranch, /직원 관리를 저장했습니다\. 다음 버튼으로 서비스·가격 단계에 이동할 수 있습니다/);
  assert.doesNotMatch(staffSaveBranch, /setActiveScreen/);
  assert.match(preview, /onStaffNext=\{\(\) => \{[\s\S]*setActiveScreen\("services"\);[\s\S]*저장 여부와 관계없이 서비스·가격 단계로 이동했습니다/);
  assert.match(preview, /DB·Auth·외부 호출을 사용하지 않습니다/);

  for (const value of [
    "영업시간·휴무일",
    "정기 휴무일",
    "임시 휴무일",
    "직원 관리",
  ]) {
    assert.match(fixtureForm, new RegExp(value.replace(/[()]/g, "\\$&")));
  }
  assert.match(staffPanel, /기본 근무 요일/);
  assert.match(fixtureForm, /<input/);
  assert.match(fixtureForm, /<select/);
  assert.match(fixtureForm, /<OwnerInitialSetupSaveNextActions onSave=\{save\} onNext=\{onNext\} \/>/);
  assert.match(fixtureForm, /onSaved\("hours"\)/);
  assert.match(fixtureForm, /onStepSaved\("staff"\)/);
  assert.match(fixtureForm, /onSaved\("pricing"\)/);
  assert.match(fixtureForm, /onSave=\{saveFixtureStaff\}[\s\S]*onNext=\{\(\) => onStaffNext\?\.\(\)\}/);
  assert.match(staffPanel, /<OwnerInitialSetupSaveNextActions onSave=\{onSave\} onNext=\{onNext\} saving=\{isSaving\} \/>/);
  assert.match(choice, /사진으로 등록/);
  assert.match(choice, /직접 등록/);
  for (const value of ["serviceName", "breedNames", "sizeClass", "minKg", "maxKg", "priceMinKrw", "durationMinutes", "note", "overallNote", "surcharges"]) {
    assert.match(editor, new RegExp(value));
  }
  assert.match(manual, /manualMatrixMode \|\| photoEditing \? \([\s\S]*<PriceGuideNativeInlineTable/);
  assert.match(manual, /<PriceGuideStructuredReviewTable[\s\S]*document=\{draft\}[\s\S]*onEdit=/);
  assert.match(manual, /photoReviewMode=\{!manualMatrixMode\}/);
  assert.match(directMatrix, /바꿀 칸을 누르면 그 자리에서 입력할 수 있어요\. 저장 버튼을 누르기 전에는 반영되지 않습니다\./);
  assert.match(directMatrix, /overflow-auto overscroll-contain/);
  assert.match(manual, /onSaveActionReady\?\.\(registeredSaveAction\)/);
});

test("local migration permits an empty service array without weakening the v5 to v4 to v1 chain", async () => {
  const [migration, v5Migration, v4Migration] = await Promise.all([
    readFile(emptyServicesMigrationPath, "utf8"),
    readFile(atomicSignupV5MigrationPath, "utf8"),
    readFile(reusedPhoneV4MigrationPath, "utf8"),
  ]);
  assert.match(migration, /PREPARED LOCALLY ONLY: do not apply or push/);
  assert.match(migration, /create or replace function public\.complete_owner_signup_v1/);
  assert.match(migration, /jsonb_typeof\(p_services\) <> 'array'/);
  assert.doesNotMatch(migration, /jsonb_array_length\(p_services\)\s*<\s*1/);
  assert.match(migration, /for v_service in select value from jsonb_array_elements\(p_services\)/);
  assert.match(migration, /raise exception 'PM_SIGNUP_INVALID_SERVICE'/);
  assert.doesNotMatch(migration, /create or replace function public\.complete_owner_signup_v[45]/);
  assert.match(v5Migration, /return public\.complete_owner_signup_v4\([\s\S]*p_shop, p_profile, p_services, p_staff/);
  assert.match(v4Migration, /select public\.complete_owner_signup_v1\([\s\S]*p_shop, p_profile - array\['ci_hash', 'di_hash'\], p_services, p_staff/);
});

test("manual signup price guide starts without invented price or duration", async () => {
  const [step, editor] = await Promise.all([
    readFile(pricingStepPath, "utf8"),
    readFile(editorPath, "utf8"),
  ]);
  assert.match(step, /source: "manual"/);
  assert.match(step, /priceKind: "unknown"/);
  assert.match(step, /priceMinKrw: null/);
  assert.match(step, /durationMinutes: null/);
  assert.doesNotMatch(step, /durationMinutes:\s*60/);
  assert.match(editor, /durationMinutes: null/);
  assert.doesNotMatch(editor, /durationMinutes:\s*\d+/);
});

test("duration is required for every signup price row and accepts integers from fifteen minutes", async () => {
  const [editor, step] = await Promise.all([
    readFile(editorPath, "utf8"),
    readFile(pricingStepPath, "utf8"),
  ]);

  for (const [durationMinutes, expected] of [
    [null, false],
    [0, false],
    [14, false],
    [14.5, false],
    [15, true],
    [60, true],
    [480, true],
    [481, false],
  ]) {
    assert.equal(isConfirmedPriceGuideDuration(durationMinutes), expected, `durationMinutes=${durationMinutes}`);
  }

  assert.match(editor, /if \(!isConfirmedPriceGuideDuration\(row\.durationMinutes\)\)/);
  assert.match(editor, /inputId: rowInputId\(index, "durationMinutes"\)/);
  assert.match(editor, /message: "소요 시간은 15~480분으로 확정해 주세요\."/);
  assert.match(editor, /issue=\{issue\("durationMinutes"\)\}/);
  assert.match(editor, /placeholder="15분 이상 입력"/);
  assert.match(step, /focusValidationIssue\(issues\[0\]\)/);
});

test("editor exposes complete V2 fields, review resolution, validation focus, and 44px controls", async () => {
  const editor = await readFile(editorPath, "utf8");
  for (const field of [
    "serviceName", "species", "breedNames", "breedGroup", "sizeClass", "minKg", "maxKg",
    "priceKind", "priceMinKrw", "priceMaxKrw", "durationMinutes", "note", "overallNote",
    "condition", "amountKrw", "percent",
  ]) assert.match(editor, new RegExp(field));
  assert.match(editor, /resolvePriceGuideV2Reviews\(document, predicate, resolution\)/);
  assert.match(editor, /확인 필요만 보기/);
  assert.match(editor, /h-11/);
  assert.match(editor, /minKg > row\.maxKg/);
  assert.match(editor, /priceMinKrw > row\.priceMaxKrw/);
  const step = await readFile(pricingStepPath, "utf8");
  assert.match(step, /document\.getElementById\(issue\.inputId\)/);
  assert.match(step, /target\?\.focus\(\)/);
});

test("signup editor blocks unknown species and size with inline Korean errors in focus order", async () => {
  const editor = await readFile(editorPath, "utf8");
  const document = {
    rows: [{ species: "unknown", sizeClass: "unknown" }],
  };
  assert.deepEqual(findPriceGuideV2ClassificationIssues(document), [
    { rowIndex: 0, field: "species" },
    { rowIndex: 0, field: "sizeClass" },
  ]);
  assert.ok(editor.indexOf('reviewKey(targetId, "species")') < editor.indexOf('reviewKey(targetId, "sizeClass")'));
  assert.match(editor, /message: "반려동물 종류를 선택해 주세요\."/);
  assert.match(editor, /message: "체급을 선택해 주세요\."/);
  assert.match(editor, /label="반려동물" review=\{review\("species"\)\} issue=\{issue\("species"\)\}/);
  assert.match(editor, /aria-invalid=\{Boolean\(issue\("species"\)\)\}/);
  assert.match(editor, /label="체급" review=\{review\("sizeClass"\)\} issue=\{issue\("sizeClass"\)\}/);
  assert.match(editor, /aria-invalid=\{Boolean\(issue\("sizeClass"\)\)\}/);
});

test("DB-free signup preview defers the price guide until initial setup", async () => {
  const preview = await readFile(previewPath, "utf8");
  assert.doesNotMatch(preview, /SignupServicePricingStep|priceGuideDocument|fixtureDocument/);
  assert.match(preview, /요금표는 가입 후 초기 설정에서 만듭니다/);
  assert.match(preview, /DB · Auth · Storage 저장 0건/);
});
