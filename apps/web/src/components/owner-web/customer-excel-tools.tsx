"use client";

import { FileDown } from "lucide-react";

import { OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import type { Guardian, Pet } from "@/types/domain";

type CustomerExcelToolsProps = {
  guardians: Guardian[];
  pets: Pet[];
  disabled?: boolean;
};

const templateHeaders = [
  "보호자명",
  "연락처",
  "고객메모",
  "알림수신",
  "반려동물이름",
  "품종",
  "몸무게kg",
  "생일",
  "반려동물메모",
  "방문일",
  "서비스명",
  "예상시간",
  "실제시간",
  "할인전금액",
  "할인금액",
  "결제금액",
  "담당자",
  "시술내용",
  "미용특이사항",
];

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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

export default function CustomerExcelTools({ guardians, pets, disabled }: CustomerExcelToolsProps) {

  function downloadTemplate() {
    downloadCsv("petmanager-data-migration-template.csv", [
      templateHeaders,
      ["정유진", "010-1234-5678", "피부 상담 필요", "Y", "우유", "말티즈", "6.1", "2021-04-15", "드라이 소리에 예민", "2026-07-20", "전체 미용", "90", "110", "70000", "5000", "65000", "정우진", "전체 미용", "피부 상태 양호"],
    ]);
  }

  function exportCustomers() {
    const petsByGuardian = new Map<string, Pet[]>();
    for (const pet of pets) petsByGuardian.set(pet.guardian_id, [...(petsByGuardian.get(pet.guardian_id) ?? []), pet]);
    const rows = guardians.filter((guardian) => !guardian.deleted_at).flatMap((guardian) => {
      const guardianPets = petsByGuardian.get(guardian.id) ?? [];
      if (guardianPets.length === 0) {
        return [[guardian.name, guardian.phone, guardian.memo, guardian.notification_settings?.enabled === false ? "N" : "Y", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]];
      }
      return guardianPets.map((pet) => [
        guardian.name,
        guardian.phone,
        guardian.memo,
        guardian.notification_settings?.enabled === false ? "N" : "Y",
        pet.name,
        pet.breed,
        pet.weight == null ? "" : String(pet.weight),
        pet.birthday_precision === "month" ? pet.birthday?.slice(0, 7) ?? "" : pet.birthday ?? "",
        pet.notes,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    });
    downloadCsv(`petmanager-customers-${new Date().toISOString().slice(0, 10)}.csv`, [templateHeaders, ...rows]);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={downloadTemplate} className={OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS}>
          <FileDown className="h-4 w-4" />
          이전 양식
        </button>
        <button type="button" onClick={exportCustomers} disabled={disabled || guardians.length === 0} className={OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS}>
          <FileDown className="h-4 w-4" />
          내보내기
        </button>
      </div>
    </>
  );
}
