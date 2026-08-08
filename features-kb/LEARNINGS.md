# Project Learnings

QABuddy가 실제 실행에서 포착한 프로젝트 고유 규칙. 모든 스킬이 시작 시 이 파일을
읽고 (`active` 항목이 레퍼런스를 오버라이드), 실행이 새로운 것을 가르치면 증거가
담긴 항목을 추가합니다. 프로토콜: references/self-improve.md.
항목 형식 — `## LRN-YYYYMMDD-NN: 제목` + **Status** (active|promoted|retired),
**Scope**, **Statement**, **Overrides**, **Evidence**.

## LRN-20260808-01: 이 저장소는 features-kb를 자체 호스팅한다
- **Status:** active
- **Scope:** all
- **Statement:** QABuddy 저장소 자신이 QABuddy 프로젝트다 — `features-kb/`는
  gitignore되지 않고 커밋된다 (installer 테스트 계획·케이스·학습이 여기 산다).
  스킬 실행 시 이 KB를 "사용자 프로젝트 KB"로 그대로 사용할 것.
- **Overrides:** 없음 (템플릿 .gitignore 주석이 이 결정을 명시)
- **Evidence:** 2026-08-08 installer 테스트 계획 작성 중 결정 — .gitignore에서
  features-kb/ 제외 해제, 사유 주석 추가.

## LRN-20260808-02: 이 프로젝트의 CI 검증 표면은 "오염된 공유 네임스페이스"다
- **Status:** active
- **Scope:** test-plan, test-cases, qa
- **Statement:** 설치 관련 테스트를 설계할 때 깨끗한 환경만 가정하지 말 것.
  `~/.claude/skills`에는 타 도구의 동명 스킬이 실존한다 — 디코이(외부 대상을
  가리키는 `setup` 링크)를 심고 생존을 단언하는 것이 이 프로젝트의 표준 패턴.
- **Overrides:** playbook/maintenance-and-ci.md (확장: CI 환경 구성에 오염 재현 추가)
- **Evidence:** 2026-08-08 이슈 #6 — 깨끗한 CI는 green인데 리포터의 실환경에서
  oh-my-claudecode의 `setup` 스킬이 실제로 삭제됨. 디코이 CI 추가 후 재발 차단.

## LRN-20260808-03: Windows PowerShell 5.1 검증 함정 목록
- **Status:** active
- **Scope:** qa, verify-fix, test-cases
- **Statement:** 이 프로젝트의 .ps1 검증 시: (1) `Write-Host`는 스트림 6 —
  캡처는 `6>&1` 필수, 아니면 단언이 공허하게 통과. (2) `Remove-Item`은 디렉터리
  심볼릭 링크에서 NRE — `.Delete()` 경유(Remove-Link). (3) BOM 없는 UTF-8은
  ANSI로 읽혀 em-dash가 스마트 따옴표(`”`)로 깨지며 **문자열 경계를 재배열해
  코드가 증발**한다 — .ps1은 반드시 BOM. (4) switch 안 `continue`는 foreach가
  아니라 switch에 적용. 검증은 pwsh 7이 아닌 실제 5.1(`shell: powershell`)로.
- **Overrides:** 없음 (레퍼런스에 PS 항목 없음 — 승격 후보)
- **Evidence:** 2026-08-08 v0.2.2 CI 첫 실행(크래시·무음 누락 실측), 이슈 #6
  CI 공허 통과 실측 — 각각 커밋 bf0c304, 3d1643f로 수정.

## LRN-20260808-04: 설치 검증은 반드시 샌드박스 HOME에서
- **Status:** active
- **Scope:** qa, e2e-write, verify-fix
- **Statement:** 이 저장소에서 setup 스크립트를 로컬 실행할 때는
  `HOME=<scratch> dist/claude/setup` 형태로 격리할 것. 개발 머신의 실제
  `~/.claude/skills`에는 QABuddy 외 도구들이 설치되어 있어 오염·삭제 위험.
- **Overrides:** 없음
- **Evidence:** 2026-08-08 디코이 검증을 스크래치 HOME으로 수행 (이슈 #6과
  동일 사고를 개발 머신에서 재현할 뻔한 구조).

## LRN-20260808-05: 메타 AC(테스트 인프라 자체)는 자기 검증으로 매핑한다
- **Status:** active
- **Scope:** test-plan, test-cases
- **Statement:** 회귀 안전망 자체를 기술하는 AC(예: "test.js가 X를 검증한다")는
  별도 TC를 만들지 않고, 매핑에 `META — <해당 인프라>가 매 실행마다 스스로 수행`
  행으로 기록한다. 테스트를 테스트하는 무한 회귀 방지.
- **Overrides:** test-cases SKILL의 "모든 AC에 최소 1개 TC" (확장: 메타 AC 예외)
- **Evidence:** 2026-08-08 /qa-test-plan 검증 실행 — AC5.1/5.2가 매핑에 없는데
  unmapped_requirements도 비어 있는 불일치 발견, 이 관례로 해소.
