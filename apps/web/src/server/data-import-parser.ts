import readExcelFile from "read-excel-file/node";

type CellValue = string | number | boolean | Date | null;

export type ParsedCustomerRow = {
  rowNumber: number;
  sheetName: string;
  guardianName: string;
  phone: string;
  guardianMemo: string;
  notificationEnabled: boolean;
  petName: string;
  breed: string;
  weightKg: number | null;
  birthday: string | null;
  petMemo: string;
  groomingCycleWeeks: number;
};

export type ParsedVisitRow = {
  rowNumber: number;
  sheetName: string;
  guardianName: string;
  phone: string;
  petName: string;
  breed: string;
  weightKg: number | null;
  visitDate: string;
  serviceName: string;
  expectedMinutes: number | null;
  actualMinutes: number | null;
  originalAmount: number;
  discountAmount: number;
  paidAmount: number;
  staffName: string;
  treatmentNotes: string;
  specialNotes: string;
};

export type ParsedPriceGuideRow = {
  rowNumber: number;
  sheetName: string;
  groupName: string;
  breedNames: string[];
  weightBand: string;
  serviceName: string;
  price: number;
  durationMinutes: number | null;
};

export type ParsedDataImport = {
  totalRows: number;
  customers: ParsedCustomerRow[];
  visits: ParsedVisitRow[];
  priceGuide: ParsedPriceGuideRow[];
  skippedRows: number;
  warnings: string[];
};

const aliases = {
  guardianName: ["보호자명", "보호자", "고객명", "회원명", "고객이름", "보호자이름", "guardianname", "customername"],
  phone: ["연락처", "전화번호", "휴대폰", "핸드폰", "보호자연락처", "mobile", "phone", "phonenumber"],
  guardianMemo: ["고객메모", "보호자메모", "회원메모", "상담메모", "guardianmemo", "customermemo"],
  notification: ["알림수신", "문자수신", "마케팅수신", "notification", "sms"],
  petName: ["반려동물이름", "반려동물명", "아이이름", "펫이름", "동물이름", "petname"],
  breed: ["품종", "견종", "묘종", "반려동물품종", "breed"],
  weight: ["몸무게kg", "몸무게", "체중kg", "체중", "weightkg", "weight"],
  birthday: ["생일", "생년월일", "반려동물생일", "birthday", "birthdate"],
  petMemo: ["아이메모", "반려동물메모", "특이사항", "펫메모", "petmemo", "petnotes"],
  groomingCycle: ["미용주기주", "미용주기", "방문주기", "groomingcycleweeks"],
  visitDate: ["방문일", "방문날짜", "미용일", "시술일", "예약일", "이용일", "visitdate", "groomingdate"],
  serviceName: ["서비스명", "미용항목", "시술명", "상품명", "메뉴명", "service", "servicename"],
  expectedMinutes: ["예상시간", "예상소요시간", "기준시간", "예상분", "expectedminutes", "durationminutes"],
  actualMinutes: ["실제시간", "실제소요시간", "작업시간", "소요시간", "실제분", "actualminutes"],
  originalAmount: ["할인전금액", "정상가", "원가", "기존가격", "originalamount", "grossamount"],
  discountAmount: ["할인금액", "할인", "discount", "discountamount"],
  paidAmount: ["결제금액", "받은금액", "실결제금액", "미용금액", "가격", "금액", "paidamount", "price"],
  staffName: ["담당자", "미용사", "직원명", "담당직원", "staff", "staffname"],
  treatmentNotes: ["시술내용", "미용내용", "스타일", "작업내용", "treatmentnotes", "stylenotes"],
  specialNotes: ["미용특이사항", "방문메모", "시술메모", "기록메모", "specialnotes", "visitmemo"],
  groupName: ["그룹명", "품종그룹", "요금그룹", "구분", "group", "groupname"],
  breedNames: ["품종목록", "대표품종", "적용품종", "품종", "breeds", "breednames"],
  weightBand: ["무게구간", "체중구간", "무게", "체중", "weightband", "weightrange"],
} as const;

type FieldName = keyof typeof aliases;

function normalizeHeader(value: CellValue) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./()[\]{}:]+/g, "");
}

const aliasSets = Object.fromEntries(
  Object.entries(aliases).map(([key, values]) => [key, new Set(values.map((value) => normalizeHeader(value)))]),
) as Record<FieldName, Set<string>>;

function fieldIndexes(headers: CellValue[]) {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(
    Object.keys(aliases).map((field) => [
      field,
      normalized.findIndex((header) => aliasSets[field as FieldName].has(header)),
    ]),
  ) as Record<FieldName, number>;
}

function headerScore(row: CellValue[]) {
  const indexes = fieldIndexes(row);
  return Object.values(indexes).filter((index) => index >= 0).length;
}

function findHeaderIndex(rows: CellValue[][]) {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 12).forEach((row, index) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestScore >= 2 ? bestIndex : -1;
}

function textValue(value: CellValue) {
  if (value instanceof Date) return dateValue(value) ?? "";
  return String(value ?? "").trim();
}

function numberValue(value: CellValue) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(textValue(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveNumber(value: CellValue) {
  const parsed = numberValue(value);
  return parsed > 0 ? parsed : null;
}

function integerMinutes(value: CellValue) {
  const parsed = positiveNumber(value);
  return parsed ? Math.min(1440, Math.round(parsed)) : null;
}

function dateValue(value: CellValue) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getUTCFullYear(), String(value.getUTCMonth() + 1).padStart(2, "0"), String(value.getUTCDate()).padStart(2, "0")].join("-");
  }
  const text = textValueWithoutDateRecursion(value);
  const match = text.match(/(20\d{2}|19\d{2})[^0-9]?(\d{1,2})[^0-9]?(\d{1,2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function textValueWithoutDateRecursion(value: CellValue) {
  return String(value ?? "").trim();
}

export function normalizeImportPhone(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function formatImportPhone(value: string) {
  const digits = normalizeImportPhone(value);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.trim();
}

function booleanValue(value: CellValue, fallback = true) {
  const normalized = normalizeHeader(value);
  if (!normalized) return fallback;
  return !["n", "no", "false", "0", "x", "아니오", "미수신", "거부", "off"].includes(normalized);
}

function readCell(row: CellValue[], indexes: Record<FieldName, number>, field: FieldName) {
  const index = indexes[field];
  return index >= 0 ? row[index] ?? null : null;
}

function splitBreedNames(value: CellValue) {
  return textValue(value).split(/[,/·|\n]/).map((item) => item.trim()).filter(Boolean);
}

function parseCsv(text: string) {
  const rows: CellValue[][] = [];
  let row: CellValue[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => textValue(value))) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => textValue(value))) rows.push(row);
  return [{ sheet: "CSV", data: rows }];
}

async function readWorkbook(buffer: Buffer, fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "csv") {
    return parseCsv(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  }
  if (extension !== "xlsx") {
    throw new Error(".xlsx 또는 .csv 파일만 올릴 수 있습니다.");
  }
  const sheets = await readExcelFile(buffer);
  return sheets.map((sheet) => ({ sheet: sheet.sheet, data: sheet.data as CellValue[][] }));
}

export async function parseDataImportFile(buffer: Buffer, fileName: string): Promise<ParsedDataImport> {
  const sheets = await readWorkbook(buffer, fileName);
  const customers: ParsedCustomerRow[] = [];
  const visits: ParsedVisitRow[] = [];
  const priceGuide: ParsedPriceGuideRow[] = [];
  const warnings: string[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  for (const sheet of sheets) {
    const headerIndex = findHeaderIndex(sheet.data);
    if (headerIndex < 0) {
      warnings.push(`${sheet.sheet} 시트에서 인식 가능한 제목 행을 찾지 못했습니다.`);
      continue;
    }
    const indexes = fieldIndexes(sheet.data[headerIndex]);
    const bodyRows = sheet.data.slice(headerIndex + 1);
    bodyRows.forEach((row, bodyIndex) => {
      if (!row.some((cell) => textValue(cell))) return;
      totalRows += 1;
      const rowNumber = headerIndex + bodyIndex + 2;
      const guardianName = textValue(readCell(row, indexes, "guardianName"));
      const phone = formatImportPhone(textValue(readCell(row, indexes, "phone")));
      const petName = textValue(readCell(row, indexes, "petName"));
      const breed = textValue(readCell(row, indexes, "breed")) || "미입력";
      const weightKg = positiveNumber(readCell(row, indexes, "weight"));
      const visitDate = dateValue(readCell(row, indexes, "visitDate"));
      const serviceName = textValue(readCell(row, indexes, "serviceName"));
      const price = Math.max(0, Math.round(numberValue(readCell(row, indexes, "paidAmount"))));
      const groupName = textValue(readCell(row, indexes, "groupName"));
      const weightBand = textValue(readCell(row, indexes, "weightBand"));
      let recognized = false;

      if (guardianName && normalizeImportPhone(phone) && petName) {
        customers.push({
          rowNumber,
          sheetName: sheet.sheet,
          guardianName,
          phone,
          guardianMemo: textValue(readCell(row, indexes, "guardianMemo")),
          notificationEnabled: booleanValue(readCell(row, indexes, "notification")),
          petName,
          breed,
          weightKg,
          birthday: dateValue(readCell(row, indexes, "birthday")),
          petMemo: textValue(readCell(row, indexes, "petMemo")),
          groomingCycleWeeks: Math.min(52, Math.max(1, Math.round(positiveNumber(readCell(row, indexes, "groomingCycle")) ?? 4))),
        });
        recognized = true;
      }

      if (visitDate && serviceName && (petName || normalizeImportPhone(phone))) {
        const discountAmount = Math.max(0, Math.round(numberValue(readCell(row, indexes, "discountAmount"))));
        const originalCell = Math.max(0, Math.round(numberValue(readCell(row, indexes, "originalAmount"))));
        const paidAmount = price || Math.max(0, originalCell - discountAmount);
        visits.push({
          rowNumber,
          sheetName: sheet.sheet,
          guardianName,
          phone,
          petName,
          breed,
          weightKg,
          visitDate,
          serviceName,
          expectedMinutes: integerMinutes(readCell(row, indexes, "expectedMinutes")),
          actualMinutes: integerMinutes(readCell(row, indexes, "actualMinutes")),
          originalAmount: Math.max(originalCell, paidAmount + discountAmount),
          discountAmount,
          paidAmount,
          staffName: textValue(readCell(row, indexes, "staffName")),
          treatmentNotes: textValue(readCell(row, indexes, "treatmentNotes")),
          specialNotes: textValue(readCell(row, indexes, "specialNotes")),
        });
        recognized = true;
      }

      if (serviceName && price > 0 && (groupName || weightBand)) {
        priceGuide.push({
          rowNumber,
          sheetName: sheet.sheet,
          groupName: groupName || "기본 그룹",
          breedNames: splitBreedNames(readCell(row, indexes, "breedNames")),
          weightBand: weightBand || "기본",
          serviceName,
          price,
          durationMinutes: integerMinutes(readCell(row, indexes, "expectedMinutes")),
        });
        recognized = true;
      }

      if (!recognized) skippedRows += 1;
    });
  }

  if (totalRows > 5000) throw new Error("한 번에 최대 5,000행까지 이전할 수 있습니다.");
  if (customers.length === 0 && visits.length === 0 && priceGuide.length === 0) {
    throw new Error("보호자·반려동물·방문기록·요금표 열을 찾지 못했습니다. 양식을 내려받아 제목을 확인해 주세요.");
  }

  const customerByNameAndPet = new Map<string, ParsedCustomerRow[]>();
  for (const customer of customers) {
    const key = `${normalizeHeader(customer.guardianName)}|${normalizeHeader(customer.petName)}`;
    customerByNameAndPet.set(key, [...(customerByNameAndPet.get(key) ?? []), customer]);
  }
  for (const visit of visits) {
    if (normalizeImportPhone(visit.phone)) continue;
    const key = `${normalizeHeader(visit.guardianName)}|${normalizeHeader(visit.petName)}`;
    const candidates = customerByNameAndPet.get(key) ?? [];
    if (candidates.length === 1) visit.phone = candidates[0].phone;
  }

  return { totalRows, customers, visits, priceGuide, skippedRows, warnings };
}
