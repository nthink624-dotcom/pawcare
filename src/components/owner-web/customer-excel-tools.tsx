"use client";

import { useRef, useState } from "react";
import { FileDown, FileUp } from "lucide-react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import type { Guardian, Pet, PetBiteLevel } from "@/types/domain";

type CustomerExcelToolsProps = {
  shopId: string;
  guardians: Guardian[];
  pets: Pet[];
  disabled?: boolean;
  onImported: (result: { guardians: Guardian[]; pets: Pet[] }) => void;
};

const templateHeaders = [
  "보호자명",
  "연락처",
  "고객메모",
  "알림수신",
  "아이이름",
  "품종",
  "몸무게kg",
  "생일",
  "아이메모",
  "미용주기주",
  "입질단계",
];

const templateSample = [
  "정우진",
  "010-0000-0000",
  "첫 방문 상담 필요",
  "Y",
  "우유",
  "포메라니안",
  "4.2",
  "2021-04-15",
  "발 만지는 것을 싫어함",
  "4",
  "none",
];

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(fileName: string, rows: string[][]) {
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.trim();
}

function toMap(headers: string[], values: string[]) {
  return headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header.trim()] = values[index]?.trim() ?? "";
    return acc;
  }, {});
}

function getValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value) return value;
  }
  return "";
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  return !["n", "no", "false", "0", "x", "아니오", "미수신", "off"].includes(normalized);
}

function parseWeight(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseGroomingCycleWeeks(value: string) {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 52 ? parsed : 4;
}

function parseBiteLevel(value: string): PetBiteLevel {
  const normalized = value.trim().toLowerCase();
  if (["mild", "약함", "주의"].includes(normalized)) return "mild";
  if (["watch", "관찰", "경계"].includes(normalized)) return "watch";
  if (["bite", "입질"].includes(normalized)) return "bite";
  if (["strong", "강함", "심함"].includes(normalized)) return "strong";
  return "none";
}

async function createGuardian(payload: unknown) {
  return fetchApiJsonWithAuth<Guardian>("/api/guardians", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateGuardian(payload: unknown) {
  return fetchApiJsonWithAuth<Guardian>("/api/guardians", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function createPet(payload: unknown) {
  return fetchApiJsonWithAuth<Pet>("/api/pets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export default function CustomerExcelTools({ shopId, guardians, pets, disabled, onImported }: CustomerExcelToolsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  function downloadTemplate() {
    downloadCsv("petmanager-customer-template.csv", [templateHeaders, templateSample]);
  }

  function exportCustomers() {
    const petsByGuardian = new Map<string, Pet[]>();
    for (const pet of pets) {
      petsByGuardian.set(pet.guardian_id, [...(petsByGuardian.get(pet.guardian_id) ?? []), pet]);
    }

    const rows = guardians
      .filter((guardian) => !guardian.deleted_at)
      .flatMap((guardian) => {
        const guardianPets = petsByGuardian.get(guardian.id) ?? [];
        if (guardianPets.length === 0) {
          return [[guardian.name, guardian.phone, guardian.memo, guardian.notification_settings?.enabled === false ? "N" : "Y", "", "", "", "", "", "4", "none"]];
        }
        return guardianPets.map((pet) => [
          guardian.name,
          guardian.phone,
          guardian.memo,
          guardian.notification_settings?.enabled === false ? "N" : "Y",
          pet.name,
          pet.breed,
          pet.weight == null ? "" : String(pet.weight),
          pet.birthday ?? "",
          pet.notes,
          String(pet.grooming_cycle_weeks ?? 4),
          pet.bite_level ?? "none",
        ]);
      });

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`petmanager-customers-${stamp}.csv`, [templateHeaders, ...rows]);
  }

  async function importCustomers(file: File) {
    setImporting(true);
    setMessage("");

    try {
      const text = await file.text();
      const [headers, ...bodyRows] = parseCsv(text);
      if (!headers || bodyRows.length === 0) {
        setMessage("가져올 고객 데이터가 없습니다.");
        return;
      }

      const guardianByPhone = new Map(guardians.map((guardian) => [normalizePhone(guardian.phone), guardian]));
      const createdGuardians: Guardian[] = [];
      const syncedGuardianById = new Map<string, Guardian>();
      const createdPets: Pet[] = [];
      let skipped = 0;

      for (const values of bodyRows) {
        const row = toMap(headers, values);
        const guardianName = getValue(row, ["보호자명", "보호자 이름", "guardianName", "name"]);
        const phone = formatPhone(getValue(row, ["연락처", "전화번호", "phone"]));
        const phoneKey = normalizePhone(phone);
        const petName = getValue(row, ["아이이름", "반려동물명", "반려동물 이름", "petName"]);

        if (!guardianName || !phoneKey || !petName) {
          skipped += 1;
          continue;
        }

        let guardian = guardianByPhone.get(phoneKey);
        if (!guardian) {
          guardian = await createGuardian({
            shopId,
            name: guardianName,
            phone,
            memo: getValue(row, ["고객메모", "보호자메모", "memo"]),
          });
          guardianByPhone.set(phoneKey, guardian);
          createdGuardians.push(guardian);
          syncedGuardianById.set(guardian.id, guardian);
        }

        const alertEnabled = parseBoolean(getValue(row, ["알림수신", "알림", "notification"]));
        if (alertEnabled === false && guardian.notification_settings?.enabled !== false) {
          guardian = await updateGuardian({ shopId, guardianId: guardian.id, enabled: false });
          guardianByPhone.set(phoneKey, guardian);
          syncedGuardianById.set(guardian.id, guardian);
          const createdIndex = createdGuardians.findIndex((item) => item.id === guardian?.id);
          if (createdIndex >= 0) createdGuardians[createdIndex] = guardian;
        }

        const pet = await createPet({
          shopId,
          guardianId: guardian.id,
          name: petName,
          breed: getValue(row, ["품종", "견종", "묘종", "breed"]) || "미입력",
          weight: parseWeight(getValue(row, ["몸무게kg", "몸무게", "weight"])),
          birthday: getValue(row, ["생일", "birthday"]) || null,
          notes: getValue(row, ["아이메모", "반려동물메모", "petMemo", "notes"]),
          biteLevel: parseBiteLevel(getValue(row, ["입질단계", "입질", "biteLevel"])),
          groomingCycleWeeks: parseGroomingCycleWeeks(getValue(row, ["미용주기주", "미용주기", "groomingCycleWeeks"])),
        });
        createdPets.push(pet);
      }

      onImported({ guardians: Array.from(syncedGuardianById.values()), pets: createdPets });
      setMessage(`등록 ${createdGuardians.length}명 / 반려동물 ${createdPets.length}마리${skipped ? `, 건너뜀 ${skipped}줄` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "엑셀 등록에 실패했습니다.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importCustomers(file);
        }}
      />
      <button
        type="button"
        onClick={downloadTemplate}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
      >
        <FileDown className="h-4 w-4" />
        양식
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || importing}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
      >
        <FileUp className="h-4 w-4" />
        {importing ? "등록 중" : "엑셀 등록"}
      </button>
      <button
        type="button"
        onClick={exportCustomers}
        disabled={disabled || guardians.length === 0}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
      >
        <FileDown className="h-4 w-4" />
        내보내기
      </button>
      {message ? <span className="text-[13px] font-medium text-[#64748b]">{message}</span> : null}
    </div>
  );
}
