const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const sourceDir = path.join(root, 'tooling/agents');
const read = name => fs.readFileSync(path.join(sourceDir, name), 'utf8').replace(/^\uFEFF/, '').trim();
const common = read('common.md');
const header = '<!-- GENERATED: edit tooling/agents sources, then node scripts/monorepo/sync-agents.cjs. -->\n';
const policy = `# PetManager 통합 저장소\n\n웹: apps/web. 모바일: apps/mobile. 공통 코드: apps/shared. 공유 서버: backend. DB 이력: supabase/migrations.\n\n- 과거 원본/복구 자료는 실행 정본이 아니며, archive 및 .migration-backup에서 보존한다.\n- .git, 비밀 설정, 미커밋 작업, 운영 데이터는 임의로 삭제하거나 외부에 올리지 않는다.\n- 원격 설정/배포 변경은 별도 승인 후 수행한다.\n- 대표 승인 없이는 하위 에이전트를 만들지 않는다.\n- 개발/캐시 산출물은 OneDrive 밖에 둔다.\n- 직접 시작한 검사 서버/브라우저만 소유권 확인 후 종료한다. 기존 개인 프로세스는 종료하지 않는다.\n`;
fs.writeFileSync(path.join(root, 'AGENTS.md'), header + policy + '\n' + common + '\n');
for (const [app, platform] of [['web', 'pc.md'], ['mobile', 'mobile.md']]) {
  fs.writeFileSync(path.join(root, 'apps', app, 'AGENTS.md'), header + common + '\n\n' + read(platform) + '\n');
}
console.log('Root, web and mobile instructions generated from one local source.');
