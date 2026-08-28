const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const outputPath = path.resolve(process.argv[2] || "artifacts/secure-ai-price-guide-import-v0.1/korean-price-guide-fixture.png");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const svg = Buffer.from(`
<svg width="760" height="1040" xmlns="http://www.w3.org/2000/svg">
  <rect width="760" height="1040" fill="#f7f1eb"/>
  <rect x="42" y="42" width="676" height="956" rx="28" fill="#fff" stroke="#253652" stroke-width="3"/>
  <text x="380" y="116" text-anchor="middle" font-size="36" font-weight="700" font-family="Malgun Gothic, sans-serif" fill="#15223a">멍샵몽샵 미용 요금표</text>
  <text x="86" y="188" font-size="24" font-weight="700" font-family="Malgun Gothic, sans-serif" fill="#31527d">5kg 이하 기준</text>
  <line x1="84" y1="218" x2="676" y2="218" stroke="#d9e0e8" stroke-width="2"/>
  <g font-family="Malgun Gothic, sans-serif" font-size="26" fill="#172033">
    <text x="92" y="294">전체 미용 · 기본 컷</text><text x="610" y="294" text-anchor="end">80,000원</text>
    <text x="92" y="344" font-size="19" fill="#64748b">약 120분 · 말티즈 / 푸들</text>
    <line x1="84" y1="382" x2="676" y2="382" stroke="#e5eaf0"/>
    <text x="92" y="458">목욕 · 기본 케어</text><text x="610" y="458" text-anchor="end">35,000원</text>
    <text x="92" y="508" font-size="19" fill="#64748b">약 60분 · 소형견</text>
    <line x1="84" y1="546" x2="676" y2="546" stroke="#e5eaf0"/>
    <text x="92" y="622">부분 미용 · 발·얼굴</text><text x="610" y="622" text-anchor="end">30,000원</text>
    <text x="92" y="672" font-size="19" fill="#64748b">약 45분</text>
  </g>
  <rect x="84" y="760" width="592" height="148" rx="18" fill="#edf5ef"/>
  <text x="380" y="818" text-anchor="middle" font-size="20" font-family="Malgun Gothic, sans-serif" fill="#176b4e">Development 비식별 보안 fixture</text>
  <text x="380" y="858" text-anchor="middle" font-size="17" font-family="Malgun Gothic, sans-serif" fill="#526174">실사용자·실사용 사진·외부 Vision 호출 없음</text>
</svg>`);

sharp(svg).png().toFile(outputPath).then(() => process.stdout.write(`${outputPath}\n`));
