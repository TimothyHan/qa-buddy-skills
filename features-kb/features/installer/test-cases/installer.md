# Test Cases: 빌드·설치·제거 파이프라인

**Feature:** `installer` | **Created:** 2026-08-08
**구현 형태:** Playwright가 아닌 CI 스텝(.github/workflows/ci.yml) + test.js 구조 검사.
"Automated" 상태는 해당 구현 위치를 인용한다. 수동 TC는 릴리스 전 체크리스트.

---

### TC-INST-001: LF 체크아웃에서 전체 빌드
**Requirement:** AC1.1, AC1.2 | **Priority:** P0 | **Type:** happy-path
**Steps:** clone → `node build.js all` → `node build.js all --locale ko`
**Expected:** 플랫폼 3종 × 14 스킬, `dist/` + `dist/ko/`, exit 0
**Status:** Automated — ci.yml "Build (en)" / "Build (ko)" (양 OS)

### TC-INST-002: CRLF 체크아웃에서 빌드 (Windows git 기본값)
**Requirement:** AC1.3 | **Priority:** P0 | **Type:** negative→happy (과거 P0 결함 회귀)
**Steps:** `git config --global core.autocrlf true` → checkout → 빌드
**Expected:** exit 0 (v0.2.0에서는 `meta.description` undefined 크래시)
**Status:** Automated — ci.yml windows 잡 (checkout 전 autocrlf 설정) + test.js `testCrlfTolerance` 단위 검사

### TC-INST-003: 산출물 무결성
**Requirement:** AC1.4, AC1.5 | **Priority:** P1 | **Type:** happy-path
**Steps:** 빌드 후 ① `grep -r "{{REFERENCE_PATH}}" dist/ | wc -l` ② `head -c 3 dist/claude/setup.ps1 | xxd`
**Expected:** ① 0건 ② `efbbbf`
**Status:** Automated — test.js `testNoRawPlaceholders` + `testDistBom` (G3 종결)

### TC-INST-004: claude 신규 설치 (깨끗한 환경)
**Requirement:** AC2.1, AC2.7 | **Priority:** P0 | **Type:** happy-path
**Steps:** `dist/claude/setup`(.ps1) 실행
**Expected:** `Installed: 15 items`, 링크 15개, 무음 분기 0
**Status:** Automated — ci.yml install 스텝 (bash + PS 5.1)

### TC-INST-005: PS 5.1 전체 사이클
**Requirement:** AC2.6, AC3.3 | **Priority:** P0 | **Type:** compat (과거 P0 결함 회귀 ×2)
**Steps:** Windows PowerShell 5.1(`shell: powershell`)에서 install → status → uninstall
**Expected:** 크래시 없음 (3-인자 Join-Path / 심볼릭 링크 Remove-Item NRE 회귀 감시)
**Status:** Automated — ci.yml windows 잡

### TC-INST-006: 디코이 생존 — 설치가 남의 것을 덮지 않음
**Requirement:** AC2.5 | **Priority:** P0 | **Type:** negative (실측 데이터 소실 회귀)
**Precondition:** `~/.claude/skills/setup` → 외부 경로 링크(디코이)
**Steps:** install 실행
**Expected:** qa-* 전부 OK, 디코이는 손대지 않음
**Status:** Automated — ci.yml decoy 스텝 (양 OS)

### TC-INST-007: 디코이 생존 — uninstall이 남의 것을 지우지 않음
**Requirement:** AC3.1, AC3.2, AC3.4 | **Priority:** P0 | **Type:** negative (이슈 #6 회귀)
**Steps:** (TC-006 이후) uninstall 실행
**Expected:** QABuddy 15개 REMOVED, 디코이는 `SKIP` 출력 후 존재 + 원래 대상 유지
**Status:** Automated — ci.yml decoy 단언 (`test -L` + `readlink` / `Test-Path` + Target 검사)

### TC-INST-008: status 정직성 — FOREIGN 구분
**Requirement:** AC4.1, AC4.2 | **Priority:** P0 | **Type:** negative (거짓 통과 회귀, 6-b)
**Steps:** 디코이 존재 상태에서 status
**Expected:** 디코이는 `FOREIGN`(OK 아님), QABuddy 항목만 OK, MISSING/FAIL/SKIP 0건
**Status:** Automated — ci.yml (`6>&1` 캡처 후 정규식 단언 — PS 5.1 Write-Host는 스트림 6)

### TC-INST-009: `-NoPrefix` 설치가 선점 항목을 만나면 FAIL
**Requirement:** AC2.5 (6-a) | **Priority:** P1 | **Type:** negative
**Steps:** 외부 소유 `setup` 존재 상태에서 `setup.ps1 -NoPrefix` / `setup --no-prefix`
**Expected:** 해당 스킬 FAIL + 수동 제거/접두사 안내, 기존 항목 무손상, 나머지는 정상 설치
**Status:** Automated — ci.yml NoPrefix 디코이 단언 (양 OS, 2026-08-08 자동화)

### TC-INST-010: cursor global/project 설치·제거
**Requirement:** AC2.3 | **Priority:** P1 | **Type:** happy-path
**Steps:** 샌드박스 HOME에서(LRN-04) ① `dist/cursor/setup` → status ② 임의 프로젝트에서 `dist/cursor/setup --project` ③ 각각 uninstall
**Expected:** ①=링크 15개, ②=`.cursor/skills/` 복사본 + 각 디렉터리에 `.qabuddy-owned` 마커, ③ 마커/소유 링크만 REMOVED
**Status:** Manual — 미검증 등급 (G1 정책 종결); 스크립트 변경 시에만 수행

### TC-INST-011: copilot 복사 설치·제거 (마커 소유권)
**Requirement:** AC2.4, AC3.2 | **Priority:** P1 | **Type:** happy-path + negative
**Precondition:** git repo 안에서 실행; `.github/skills/`에 마커 없는 외부 디렉터리 1개 (디코이, LRN-02)
**Steps:** ① `dist/copilot/setup` ② status ③ `dist/copilot/setup --uninstall` ④ 디코이 디렉터리 존재 확인
**Expected:** ① 각 설치본에 `.qabuddy-owned` 생성 ② 디코이 FOREIGN ③ 마커 있는 것만 REMOVED, 디코이 `SKIP` ④ 무손상
**Status:** Manual — 미검증 등급 (G1 정책 종결); 스크립트 변경 시에만 수행

### TC-INST-012: junction 폴백 (비관리자 + 개발자 모드 OFF)
**Requirement:** AC2.2 | **Priority:** P1 | **Type:** compat
**Steps:** 개발자 모드 OFF + 비관리자 PowerShell에서 `dist\claude\setup.ps1` → status → 스킬 1개 호출 확인
**Expected:** `OK ... (junction)` 출력, status 정상, 스킬 로드 동일
**Status:** Manual — M1 (CI 재현 불가)

### TC-INST-013: 재설치 멱등성
**Requirement:** AC2.1+AC2.5 조합 | **Priority:** P1 | **Type:** edge
**Steps:** install 성공 직후 install 재실행
**Expected:** 15개 전부 OK (자기 설치분은 소유 판정 → 교체), FAIL 0
**Status:** Automated — ci.yml 2회차 install 단언 (양 OS, FAIL/SKIP 0 + OK ≥15)

### TC-INST-014: ko 단독 빌드 + 테스트
**Requirement:** AC1.2 | **Priority:** P2 | **Type:** edge (과거 P2 결함 회귀)
**Steps:** `rm -rf dist` → `node build.js all --locale ko` → `node test.js`
**Expected:** 0 failed (`resolvePlatformDir`가 `dist/ko/` 인식)
**Status:** Automated — ci.yml이 ko 빌드 직후(en 빌드 전) test.js 실행 (ubuntu)

### TC-INST-015: 업그레이드 — 마커 없는 구버전(≤v0.2.2) 복사 설치본
**Requirement:** Missing ACs 4행 | **Priority:** P2 | **Type:** edge
**Steps:** v0.2.2 태그로 copilot 설치(마커 없음) → 현재 버전으로 재설치 시도 → 안내대로 `qa-*` 수동 제거 → 재설치
**Expected:** 재설치 시도는 FAIL + 수동 제거 안내 (무단 삭제 없음); 수동 제거 후 재설치 전부 OK + 마커 생성
**Status:** Manual — M5

### TC-INST-016: `--adopt` 레거시 인수 — 증거 기반, 오인수 금지
**Requirement:** AC2.8 | **Priority:** P1 | **Type:** happy-path + negative
**Precondition:** git repo의 `.github/skills/`에 ① 마커 없는 레거시 QABuddy 복사본(qa-test-plan, SKILL.md에 "QABuddy" 포함) ② 마커·증거 모두 없는 동명 외부 디렉터리(qa-eval)
**Steps:** `dist/copilot/setup --adopt` → 마커 확인 → `--uninstall` → 외부 디렉터리 확인
**Expected:** ①만 `ADOPTED` + 마커 생성 후 정상 교체; ②는 인수되지 않고 `FAIL` 안내, uninstall에서 `SKIP` 후 보존
**Status:** Automated — ci.yml 스모크 3종: copilot bash·cursor bash(project)·copilot ps1(PS 5.1) + test.js 구조 검사; 잔여 수동은 cursor ps1 변형뿐

---

## 단위(구조) 테스트 체크리스트 (test.js — 개발자용)

이 도메인의 "단위 계층"은 test.js 구조 검사다. 커버 현황:

- [x] frontmatter 파서: CRLF 입력 처리 + body에 `\r` 잔존 없음 (`testCrlfTolerance`)
- [x] `.gitattributes` 존재 (eol 정규화)
- [x] 스크립트 6종: 동적 스킬 순회, 하드코딩 배열 부재 (`testInstallerSkillSync`)
- [x] 스크립트 6종: 소유권 메커니즘 존재 (Test-Owned / readlink / 마커 / FOREIGN)
- [x] dist 존재(로케일 인식) + 플레이스홀더 치환 (`testBuildOutput`, `testNoRawPlaceholders`)
- [x] dist `.ps1` BOM 선두 바이트 단언 (`testDistBom`, G3 종결)
- [x] KB 경로 오염 가드 (`testKbPathHygiene` — `}/qa-*` 스캔, qa-reports 제외)

---

## Traceability 요약

전체 매핑: [installer-mapping.json](installer-mapping.json)
- AC 20개: full 15 (메타 AC5.1/5.2 포함), partial 4 (G3·미검증 등급 갭 기록), 미커버 0
  (AC4.1/4.2는 매핑 1행으로 묶임; AC5.x는 테스트 인프라 자체라 CI 실행으로 자기 검증)
- TC 우선순위: P0 7 / P1 6 / P2 2 (P0 47% — ≤50% 규칙 준수)
- P0 7건 + P1 5건(003/009/013/014/016) Automated; 과거 결함 전건 회귀 TC 보유
- 잔여 수동: TC-010/011(미검증 등급), TC-012(junction), TC-015→016 ps1 변형
