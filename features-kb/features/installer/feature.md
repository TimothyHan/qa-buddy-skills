# Feature: 빌드·설치·제거 파이프라인 (installer)

**Key:** `installer` (slug — Jira 없음, contextSource: spec)
**Source:** README.md 빠른 시작, platforms/setup-* 스크립트 6종, build.js, 이슈 리포트 3건 (v0.2.0 / v0.2.2 재검증 / 이슈 #6)
**Created:** 2026-08-08

## 개요

QABuddy가 사용자 머신에 도달하는 전체 경로: `git clone` → `node build.js` →
`dist/<platform>/setup(.ps1)` → install / status / uninstall. 플랫폼 3종
(claude/cursor/copilot) × 셸 2종 (bash/PowerShell) × 로케일 2종 (en/ko) ×
OS 3종 (macOS/Linux/Windows). 설치 대상 디렉터리(`~/.claude/skills` 등)는
**여러 도구가 공유하는 전역 네임스페이스**라는 것이 이 기능의 핵심 리스크.

## Capabilities

### C1. 빌드 (build.js)
- AC1.1: `node build.js all` → 3개 플랫폼 × 14개 스킬 + references + 지침 파일 + setup 스크립트 생성
- AC1.2: `--locale ko` → `dist/ko/` 아래 동일 구조
- AC1.3: CRLF로 체크아웃된 소스에서도 빌드 성공 (Windows `core.autocrlf=true`)
- AC1.4: 생성물의 `{{REFERENCE_PATH}}` 플레이스홀더 전부 치환
- AC1.5: `.ps1`의 UTF-8 BOM이 dist 복사본에 보존

### C2. 설치
- AC2.1 (claude): 스킬 14개를 `~/.claude/skills/qa-<skill>` 심볼릭 링크로, references를 `qa-references`로 설치
- AC2.2 (claude/Windows): 심볼릭 링크 권한 없으면 junction으로 폴백
- AC2.3 (cursor): global(링크) / `--project`(복사 + `.qabuddy-owned` 마커) 모드
- AC2.4 (copilot): repo `.github/skills/`에 복사 + 마커
- AC2.5: 자리를 차지한 **미소유** 항목은 삭제·덮어쓰기 대신 FAIL 안내 (`-NoPrefix` 포함)
- AC2.6: Windows PowerShell 5.1(OS 기본)에서 추가 설치 없이 동작
- AC2.7: 모든 설치 분기가 출력을 냄 (OK/FAIL/SKIP — 무음 경로 없음)

### C3. 제거
- AC3.1: QABuddy가 설치한 항목 전부 제거 (스킬 + references + 레거시 이름)
- AC3.2: **소유 검증** — 이름이 겹쳐도 타 도구의 링크/디렉터리는 SKIP 출력 후 보존
- AC3.3: PS 5.1에서 디렉터리 심볼릭 링크 삭제 시 크래시 없음 (`.Delete()` 경유)
- AC3.4: 링크 삭제가 링크 **대상** 내부로 재귀하지 않음

### C4. 상태 조회
- AC4.1: 설치분 OK / 미설치 MISSING / 미소유 동명 항목 FOREIGN으로 구분
- AC4.2: FOREIGN이 OK로 집계되어 실제 누락을 가리지 않음 (거짓 통과 차단)

### C5. 회귀 안전망
- AC5.1: test.js가 스크립트 6종의 소유권 메커니즘·동적 순회·CRLF 내성을 구조적으로 검증
- AC5.2: CI가 Linux + Windows(PS 5.1, autocrlf=true)에서 디코이를 심고 install→status→uninstall 전 사이클 검증

## Missing ACs / 미확정

| 항목 | 상태 |
|---|---|
| 지원 Node.js 최소 버전 | 문서 미명시 (README는 "Node.js"만 요구) |
| Windows 비관리자(junction 폴백) 경로의 공식 지원 선언 | 스크립트는 구현했으나 문서·테스트 없음 |
| cursor/copilot 스크립트의 CI 커버리지 | 없음 — claude만 CI에서 실행됨 |
| v0.2.2 이하 copilot/cursor-project 설치본(마커 없음) 업그레이드 절차 | 릴리스 노트로만 안내 |
