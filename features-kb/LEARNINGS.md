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

## LRN-20260808-06: bash 설치 스크립트 검증 함정 목록
- **Status:** active
- **Scope:** qa, verify-fix, test-cases
- **Statement:** 이 프로젝트의 bash 스크립트 검증 시: (1) 함수 마지막 줄의
  `[ cond ] && cmd` 패턴은 cond가 거짓이면 함수 반환값이 1 — `set -e`(CI 기본)
  아래서 스크립트 즉사. 함수는 명시적 `return 0`으로 끝낼 것. (2) macOS bash
  3.2와 linux bash 5의 `set -e` 의미가 달라 로컬 통과가 CI 통과를 보장하지
  않음 — 로컬 검증은 `bash -e <script>`로 CI 조건을 강제할 것. (3) 테스트
  픽스처 문구는 로컬과 CI에서 동일해야 함 — 증거 검사가 문자열 grep이므로
  픽스처 내용에 검사 대상 문자열("QABuddy")을 넣는 순간 자충수.
- **Overrides:** 없음 (LRN-20260808-03의 bash 대응편 — 승격 후보)
- **Evidence:** 2026-08-08 --adopt CI 스모크 첫 실행 2연속 실패 실측 —
  픽스처 자충수(d76b22e), set -e 반환값 트랩(649cf39). 로컬은 양쪽 모두 통과했었음.

## LRN-20260808-07: KB 산출물 작업의 스킬 사용 관례
- **Status:** active
- **Scope:** all
- **Statement:** 이 저장소에서 KB 산출물(feature/test-plan/test-cases)을 다룰 때:
  **생성과 주기 검증은 반드시 스킬 정식 실행**(/qa-test-plan, /qa-test-cases —
  자체 검증 체크리스트·일시정지·포착 트리거의 규율이 실제 결함을 잡음).
  코드 변경에 동반되는 **증분 동기화는 직접 편집 허용** — 단, 다음 스킬 검증
  실행이 드리프트를 점검한다는 전제. 직접 편집분이 쌓이면 검증 실행을 돌릴 것.
- **Overrides:** 없음
- **Evidence:** 2026-08-08 SDT 확정. 근거 실측: 스킬 검증 실행이 집계 드리프트
  3건을, 정식 호출이 스킬 지침의 경로 오염 24건을 잡았고, 직접 편집(adopt
  라운드)은 그 안전망 밖이었음.

## LRN-20260809-08: 외부 연습 앱 세션은 이 저장소의 features-kb/index.json에 등록하지 않는다
- **Status:** active
- **Scope:** exploratory, qa, test-cases, test-plan
- **Statement:** 이 저장소(QABuddy 자체)의 `features-kb/index.json`은 QABuddy
  자신의 기능(installer 등)만 추적한다(LRN-20260808-01). automationintesting.online
  같은 외부 공개 연습 앱을 대상으로 한 탐색적/기능 테스트 세션은 `.qa-reports/`에만
  저장하고 `index.json`·`features-kb/features/`에는 등록하지 않는다 — QABuddy 자신의
  기능 추적을 무관한 연습 세션으로 오염시키지 않기 위함.
- **Overrides:** 없음 — 일반 프로토콜(KB에 산출물 저장)의 예외 사례
- **Evidence:** 2026-08-09 automationintesting.online 탐색 세션에서 처음 발생.
  `.qa-reports/exploratory-EXT-RBP-2026-08-09.md`로 저장, index.json 미수정.
