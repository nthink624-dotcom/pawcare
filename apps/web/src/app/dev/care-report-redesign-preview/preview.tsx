"use client";

import { IconMessageCircle as MessageCircle } from "@tabler/icons-react";

import { CustomerGroomingResultCard } from "@/components/customer/customer-grooming-result-card";
import { CustomerReportSectionTitle } from "@/components/customer/customer-report-section-title";

import { careReportPreviewProps } from "../care-report-preview/fixture";
import styles from "./preview.module.css";

const reportText = "목욕은 잘 받아주었으며 얼굴은 동그랗게 정리했습니다. 앞발을 만질 때 예민해 중간중간 쉬어가며 진행했습니다.";

export function CareReportDesignPreview() {
  return (
    <main className={styles.stage}>
      <p className={styles.previewLabel}>케어리포트 디자인 시안 · 예시 데이터</p>
      <div className={styles.device}>
        <div className={styles.viewport} data-phone-viewport>
          <div className={styles.report} data-report-root>
            <CustomerGroomingResultCard
              {...careReportPreviewProps}
              embedded
              record={{ ...careReportPreviewProps.record, care_report_data: { ...careReportPreviewProps.record.care_report_data, reportText } }}
              headerContent={
                <header className={styles.header}>
                  <p className={styles.eyebrow}>케어리포트</p>
                  <h1>{careReportPreviewProps.petName}의 케어리포트</h1>
                  <div className={styles.dateLine}><span>2026년 8월 18일</span><span className={styles.dot} aria-hidden="true">·</span><span>전체미용</span></div>
                </header>
              }
              summaryContent={
                <div>
                  <CustomerReportSectionTitle icon={<MessageCircle aria-hidden="true" />}>오늘의 리포트</CustomerReportSectionTitle>
                  <div className={styles.speechBubble}><p>{reportText}</p></div>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </main>
  );
}
