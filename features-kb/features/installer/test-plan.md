# Test Plan: 빌드·설치·제거 파이프라인

**Epic:** `installer` | **SDT:** Timothy | **Sprint:** n/a (지속 관리)
**Created:** 2026-08-08 | **Status:** Active

## 1. Overview

설치 파이프라인은 v0.2.x에서 실사용 리포트 3건(총 8개 결함, P0 4건 포함 — CRLF 크래시,
PS 5.1 비호환, e2e 스킬 설치 누락, **타 도구 스킬 삭제**)을 냈다. 근본 원인은 공통적:
**CI가 macOS 개발 환경만 대변했고, 설치 대상이 공유 네임스페이스라는 사실을 테스트가
몰랐다.** 이 계획은 그 재발을 막는 상시 안전망을 정의한다.

## 2. Scope

**In:** build.js (en/ko), setup 스크립트 6종의 install/status/uninstall, 소유권 안전,
PS 5.1/bash 3.2 호환, CRLF/BOM 인코딩 내성.
**Out:** 스킬 실행 품질(/eval 소관), MCP 서버 자체, Jira/Confluence 연동.

## 3. Test Strategy

계층 분배는 test-distribution.md의 피라미드를 이 도메인에 맞게 번역한다:
**구조 검증(test.js, 초 단위·다수) → CI 통합(실제 스크립트 실행, 분 단위·중간) →
수동 OS 매트릭스(실기기, 릴리스 전·소수)**.
(2026-08-08 갭 종결: G2·G3·TC-009·TC-014·M2 자동화 — CI가 PS 5.1과 7 양쪽에서
멱등성·NoPrefix 디코이 보호까지 단언. 잔여 수동: M1 junction, M4 비ASCII 경로, M5 업그레이드)

### 구조 검증 (test.js — 피라미드 하단)

| # | 검사 | Priority | Status |
|---|---|---|---|
| S1 | CRLF frontmatter 파싱 + .gitattributes 존재 | P0 | Confirmed: test.js `testCrlfTolerance` |
| S2 | 스크립트 6종 동적 스킬 순회 (하드코딩 배열 금지) | P0 | Confirmed: test.js `testInstallerSkillSync` |
| S3 | 스크립트 6종 소유권 메커니즘 존재 (Test-Owned / readlink / 마커 / FOREIGN) | P0 | Confirmed: test.js `testInstallerSkillSync` ownership 블록 |
| S4 | dist 산출물 존재 (로케일 인식) + 플레이스홀더 치환 | P1 | Confirmed: test.js `testBuildOutput`, `testNoRawPlaceholders` |

### CI 통합 (GitHub Actions — 피라미드 중단)

| # | 시나리오 | Priority | Status |
|---|---|---|---|
| C1 | Linux: en+ko 빌드 → test.js → claude bash install→status→uninstall | P0 | Confirmed: ci.yml ubuntu 잡 |
| C2 | Windows: `autocrlf=true` 체크아웃 재현 후 동일 사이클, **실제 PS 5.1** | P0 | Confirmed: ci.yml `shell: powershell` |
| C3 | 디코이 생존: 외부 도구 링크가 전 사이클 후 원래 대상 그대로 | P0 | Confirmed: ci.yml decoy 단계 (양 OS) |
| C4 | status 정직성: MISSING/FAIL/SKIP → 잡 실패, 디코이는 FOREIGN 표기 필수 | P0 | Confirmed: ci.yml 단언 (PS는 `6>&1` 캡처) |
| C5 | cursor/copilot 스크립트 install→uninstall 사이클 | P2 | **De-scoped** — 미검증 등급 (2026-08-08 결정): 공식 지원은 Claude Code, cursor/copilot은 구조 검증(S2·S3)만. 설치 스크립트가 UNVERIFIED 배너 출력 |
| C6 | 재설치 멱등성 (owned 설치 위에 재실행 → 전부 OK) | P1 | Confirmed: ci.yml 2회차 install 단언 (양 OS) |
| C7 | `--adopt` 마이그레이션: 증거 있는 레거시만 인수, 없는 것은 보존 | P1 | Confirmed: ci.yml "Adopt migration smoke" (linux, copilot bash) — **미검증 등급의 의도된 예외**: adopt가 깨지면 구제 대상 사용자가 고립되므로 이 경로만 CI 실행 |

### 수동 / 탐색 (실기기 매트릭스 — 피라미드 상단)

| # | 영역 | 무엇을 | 왜 수동인가 |
|---|---|---|---|
| M1 | Windows 비관리자 + 개발자 모드 OFF | junction 폴백 경로 실동작 | CI 러너는 항상 관리자 — 권한 상태 재현 불가 |
| M3 | macOS (bash 3.2 + zsh 기본 셸) | 전체 사이클 + 디코이 | 개발 머신 = 준상시 커버 (2026-08-08 디코이 포함 실측 green) |
| M4 | 비ASCII/공백 경로 (`D:\자동화\...`) | clone 경로 특이성 | 리포터 실측으로 동작 확인됨 — 회귀 시 재확인용 |
| M5 | v0.2.2→현재 업그레이드 | `--adopt` 경로는 C7이 CI 커버; ps1 변형(-Adopt)만 수동 (미검증 등급) | ps1은 CI 미실행 — 스크립트 변경 시 수동 |

## 4. Automation Gap Analysis

| Area | Current Coverage | Gap | Effort |
|---|---|---|---|
| G1: cursor/copilot 스크립트 | 정책으로 종결 — 미검증 등급 (README·설치 배너에 명시) | 공식 승격 시 CI 매트릭스 확장 필요 (copilot은 git repo, cursor는 2모드) | M (보류) |
| G4: junction 폴백 | No coverage (M1 수동 의존) | 러너에서 권한 박탈이 비현실적 — 수동 유지가 합리적 | L (부적합) |

## 5. Environment & Test Data

- CI: ubuntu-latest / windows-latest (PS 5.1은 `shell: powershell`), Node 20
- Windows 잡은 checkout **전** `core.autocrlf=true` — 실사용자 git 기본값 재현
- 디코이 픽스처: `/tmp/foreign-tool/setup` (`%TEMP%\foreign-tool\setup`)을 가리키는 `setup` 링크
- 로컬 검증은 반드시 샌드박스 HOME (`HOME=<scratch> dist/claude/setup`) — 실 계정 스킬 디렉터리 오염 금지

## 6. Entry / Exit Criteria

**Entry:** main에 머지될 모든 커밋 (CI가 push/PR마다 전체 실행)
**Exit (릴리스):** CI green + test.js 전체 green + 스크립트 변경 시 M1–M3 중 해당 항목 수동 확인 + 신규 결함은 실패 재현 테스트가 먼저 red

## 7. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| 공유 네임스페이스에서 타 도구 데이터 파괴 | Blocker | Low (수정 후) | 소유권 검증 + 디코이 CI (C3) + S3 구조 검사. **관련 코드 리뷰 시 최우선 확인 항목** |
| PS 5.1 고유 동작 (스트림, 심볼릭 링크, 인코딩) | Critical | Medium | CI가 pwsh가 아닌 실제 5.1로 실행; PS 5.1 함정 목록을 LEARNINGS.md에 축적 |
| 무음 실패 경로 재유입 | Major | Medium | C4 status 정직성 단언 + "모든 분기는 출력" 원칙 (feature.md AC2.7) |
| cursor/copilot(미검증 등급) 잠복 결함 | Major | Medium | 사용자 기대 관리: README·설치 배너에 미검증 명시, 리포트 기반 대응. 스크립트 변경 시 수동 검증 권장 |

## 8. Success Criteria

리포터 시나리오(오염된 공유 네임스페이스 + Windows 기본 환경)에서 clone부터
uninstall까지 우회 없이 완주하고, 타인의 것은 바이트 하나 건드리지 않는다.
