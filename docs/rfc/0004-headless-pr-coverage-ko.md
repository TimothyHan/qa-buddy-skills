# RFC 0004 — 헤드리스 모드와 PR 트리거 커버리지 실행

| | |
|---|---|
| **상태** | Accepted — 0.9.0에 실험적으로 배포 (§4 기준 전부 데모 저장소에서 충족) |
| **저자** | Timothy Han (Claude와 함께) |
| **작성** | 2026-09-04 |
| **의존** | RFC 0001 (실행 프로토콜, 증거 로그), RFC 0003 (Akela 엔진); KB 명세 §6.5 |
| **대체** | 없음 — 대화형 동작은 그대로; 헤드리스는 옵트인 |
| **로케일** | 이 문서는 [영문 원본](0004-headless-pr-coverage.md)의 **비규범 전문 번역**입니다. 두 판이 다르면 영문판이 규범입니다. |

## 1 · 문제

QABuddy는 구조상 대화형이다. 모든 스킬이 SDT를 위해 멈춘다 — 페이즈마다 Review
Options, 차터 전의 "이렇게 맞나요?", 페이지 객체 스크린샷의 "확인?" — 그리고 가이드
워크플로우는 사람 없이는 나아가지 않는다. 키보드 앞의 QA 엔지니어에게는 올바른 기본값이다.
동시에 스킬과 풀 리퀘스트 사이를 가로막는 유일한 것이기도 하다: PR에는 경계 지어진 diff,
자연스러운 트리거, 결과를 쓸 자리, 이미 기다리는 리뷰어가 있지만, (A)라고 답할 사람이
없다.

그 아래에 더 작은 간극 둘이 있다. 지식 베이스의 어디에도 *기능이 어떤 코드를 소유하는지*가
없어, diff를 그것이 건드린 기능에 매핑할 수 없다. 그리고 테스트 커버리지는 AC마다
`full | partial | none`으로만 서술된다 — 매핑이 기록한 의도이지 디스크 위의 증명이 아니다 —
그래서 계층별 커버리지 뷰(unit / API / e2e / manual / exploratory)는 끌어올 데이터가
없다.

이 RFC는 워크플로우가 기존 스킬을 PR에서 사람 없이 실행하고 정직한 커버리지 코멘트 하나를
올릴 수 있게 하는 최소 집합을 더한다: 헤드리스 모드, 기능별 `sources.json`, 정규 계층
매핑, 그리고 모델이 해서는 안 되는 모든 것을 하는 결정적 스크립트.

## 2 · 결정

1. **새 스킬 없음.** 헤드리스는 기존 스킬의 *모드*로, Tier 1 프리앰블
   (`core/preamble-base.md` "Headless Mode")에 한 번 정의되고 진짜로 막는 소수의 게이트에서
   다시 강조된다. 스킬이 스킬을 호출하고(`/qa-e2e-write` → `/qa-e2e-pom`) 환경 변수는 그
   도약을 살아남으므로 `QABUDDY_HEADLESS=1`이 주 스위치다; `--headless`는 호출별 별칭이다.
   기본값은 그대로다: `/qa-start`가 멈춘다고 단언하는 eval 픽스처는 여전히 green이다.
2. **결정성 경계.** 매핑, 점수화, 렌더링, 게시하는 모든 것은 `bin/pr-coverage.js`
   (의존성 0, `{{REFERENCE_PATH}}/bin/pr-coverage.js`로 배포)에 산다. 모델은 지식 베이스와
   Playwright 산출물을 만든다; "covered"가 무슨 뜻인지 결정하지 않고 GitHub API와 대화하지
   않는다. 워크플로우는 스킬 전에(`touched`) 그리고 후에(`heatmap`, `comment`) 스크립트를
   실행한다.
3. **쓰기 범위.** 헤드리스 실행은 `features-kb/`, `playwright/`, `playwright.config.*`,
   `.qa-reports/` 아래에만 쓴다. 커밋, 푸시, PR 열기는 절대 하지 않는다. 전달은 워크플로우의
   일이다: 소스 PR의 고정 코멘트 하나(마커 `<!-- qabuddy:heatmap -->`로 찾아 제자리에서
   패치)와 브랜치 `qabuddy/pr-<n>`의 동반 PR 하나 — **소스 PR의 head 브랜치로**(Timothy의
   결정, 2026-09-05: 그러면 diff는 테스트뿐이고, 테스트는 기능과 함께 베이스 브랜치에
   도달한다) — 워크플로우 스텝이 열고 소스 PR의 코멘트로 한 번 알린다. 베이스 브랜치에 직접
   쓰는 것은 없다.
4. **`features-kb/features/<key>/sources.json`**(KB 명세 §6.8)이 정규 diff→기능 매핑이다:
   기능이 소유하는 `sources` glob, 테스트가 사는 `tests.{unit,api,e2e}` glob, 둘 모두를
   이기는 `exclude`. `/qa-test-plan`이 쓴다(4b 단계; 대화형에서는 제안 후 확인, 헤드리스에서는
   필수). diff에 맞는 기능이 없을 때 워크플로우의 기본은 `--fallback none`이다: 아무것도
   실행되지 않고, 아무것도 쓰지 않으며, 코멘트가 매핑되지 않은 파일을 이름으로 알린다.
   `--fallback all`(모든 기능, 코멘트에 표시)은 아직 `sources.json`을 쓰지 않은 저장소를
   위한 옵트인이다.
5. **매핑 형태는 KB 명세 §6.5** — `testCases[{id, layer, type, status}]`, `unitTests[]`,
   `coverage` — 두 모드 모두에서 `/qa-test-cases`가 쓴다. 스캐너는 레거시 두 형태
   (`e2e_tests[]`/`unit_tests[]`, 평면 `tests[]`)와 읽기 호환을 유지하고, `META — …`
   문자열은 인프라 증거로 다루며 절대 TC id로 다루지 않는다.
6. **증거 규칙.** 히트맵 셀은 해석된 경로가 있을 때만 `covered`다: `test()` 제목에 TC id를
   담은 스펙(Playwright JSON 리포터가 있으면 그 pass/fail과 함께), AC나 TC를 이름 짓는 단위
   파일, 그 TC를 실행한 저장된 QA 보고서, 또는 그 AC를 나열한 탐색 세션 행. 증명 없이
   존재하는 테스트 케이스는 `partial`; 테스트 케이스가 없으면 `gap`. test-plan의 "파일 경로
   없이 커버리지를 주장하지 않는다"를 계층마다 적용한 것이다.
7. **헤드리스 탐색은 KB에 영속된다** —
   `features-kb/features/<key>/exploratory/<date>.md`(KB 명세 §6.9) — `/qa-exploratory`가
   gitignore된 `.qa-reports/` 아래에 저장하는 것과 같은 보고서이며, Focus Area Results에
   `ACs` 열이 있어 Exploratory 열이 증거를 갖는다. 잠정적: §5 참조.
8. **런타임**은 `prompt`(자동화 모드)를 가진 `anthropics/claude-code-action@v1`, 고객
   자신의 `ANTHROPIC_API_KEY`, 페이즈별 `--max-turns`와 `--max-budget-usd`, 명시적
   `--allowedTools` 목록, 이중 안전장치로서의 `--disallowedTools AskUserQuestion`, 그리고
   브라우저를 위해 `--mcp-config`로 붙는 Playwright MCP(`@playwright/mcp --headless`)다.
   스킬은 러너에 `dist/claude/setup`으로 설치된다(전역 심링크, CI가 ubuntu에서 이미 증명).
   액션은 워크플로우 자신의 `github_token`을 받으므로 Claude GitHub App 설치가 필요 없다 —
   고정 코멘트와 동반 PR은 액션이 아니라 워크플로우 스텝이 게시한다.
9. **페이즈는 라벨이나 코멘트로 선택되며, 절대 모든 푸시마다가 아니다.** `pull_request`
   `opened` / `ready_for_review`는 값싼 `kb` 페이즈(테스트 케이스, 매핑, 갭, 히트맵)를
   실행한다. 라벨 `qa:explore`, `qa:automate`, `qa:full`이 비싼 페이즈를 더한다; 코멘트의
   `/qabuddy [explore|automate|full]`이 재실행한다. PR당 concurrency 그룹 하나,
   cancel-in-progress. 드래프트는 건너뛴다.
11. **페이즈당 세션 하나.** `kb`, `explore`, `automate`는 각각 자기 `--max-turns` /
    `--max-budget-usd`와 `continue-on-error: true`를 가진 별도의 `claude-code-action` 호출로
    실행된다. 뒤 페이즈는 앞 페이즈가 쓴 파일 위에 쌓는다. 전달 스텝은 `always()`로
    실행된다; 마지막 스텝은 만들어진 것이 모두 전달된 뒤, 어느 페이즈든 실패했으면 잡을
    실패시킨다.
13. **리뷰 게이트는 머지다.** 리뷰어가 소스 브랜치로 머지한 동반 PR이 계속하라는 신호다:
    워크플로우(트리거 `pull_request: closed`, head `qabuddy/pr-<n>`, merged)가 PR `<n>`에서
    나머지를 실행한다 — `after-companion-merge` 입력, 기본 `full`(explore는 automate와
    병렬로 실행되므로 약 1달러가 더 들고 벽시계 시간은 늘지 않는다 — Timothy의 결정), 머지된
    동반 PR이 이미 자동화를 담고 있었으면 건너뛴다. 이것이
    Timothy가 물었던, 추가 워크플로우 없는 리뷰된 페이즈별 체인이다:
    열림 → kb 동반 PR → 리뷰 + 머지 → automate 동반 PR → 리뷰 + 머지.
    동반 PR 자체는 절대 자기 실행을 트리거하지 않는다.
14. **게이팅은 봇이 아니라 소유자의 것이다.** 모든 잡이 검사를 보고하지만, 실패한 스펙을
    찾은 실행도 green으로 끝난다 — 그 실패가 바로 실행이 전달하는 것이다. `gate` 잡은
    호출자가 고른 정책(`gate-on`: 기본 `none`, `at-risk`, `suite`, `gaps`)을
    `qabuddy / gate`라는 검사 하나로 바꾼다; 그것이 머지를 막는지는 저장소 소유자만 정하는
    브랜치 규칙이다(Timothy의 지적, 2026-09-05). QABuddy는 그 설정을 절대 건드리지 않는다.
16. **전달은 호출자의 선택이다.** `delivery: companion-pr`(기본)은 생성 파일을 따로 리뷰할
    수 있게 유지하고 머지가 체인을 잇게 한다; `delivery: commit`은 PR 하나를 선호하는 팀을
    위해 소스 PR의 브랜치에 바로 푸시한다 — 동반 PR 없음, 체인 없음, 히트맵은 여전히 갱신,
    워크플로우 토큰을 쓰므로 푸시가 워크플로우를 재트리거할 수 없다. PR #2에서 증명
    (2026-09-06): kb 실행 → 브랜치에 커밋, PR head 이동, 노트 게시, $0.66.
12. **재사용 워크플로우 하나, 저장소 여럿.** `.github/workflows/pr-coverage.yml`
    (`workflow_call`)이 잡 `resolve → preflight → kb → (explore ∥ automate) →
    deliver`를 소유한다; 소비 저장소는 `pr-coverage.js init`이 쓴 ~15줄 호출자를 갖고, 그것은
    앱 실행법(`app-start`, `app-url`, …)만 말하고 시크릿을 상속한다.
    프롬프트, `render.js`, `install.sh`, MCP 설정은 QABuddy와 함께
    `.github/pr-coverage/` 아래로 배포되므로 워크플로우와 스킬은 항상 같은 버전이다.
    페이즈는 트리를 아티팩트로 서로 넘긴다; `deliver`는 explore와 automate를
    `pr-coverage.js merge`로 합친다(3-way, kb 트리를 base로, `.jsonl` 줄 합집합, 충돌은
    automate를 유지하고 보고). `preflight`는 지출 전에 설정, 기능, `sources.json`, 토큰
    시크릿, PR 생성 설정을 검사하고 빠진 것을 고정 코멘트로 설명한다.
10. **포크 PR은 건너뛴다.** GitHub는 포크에 시크릿을 주지 않고 실행에는 API 키와 쓰기
    토큰이 필요하다; 워크플로우의 `if:`가 head 저장소를 검사한다. 이것은 해결이 아니라
    문서화다 — 호스팅 서비스라면 포크를 읽기 전용으로 실행할 것이다.
17. **체인은 옵트인이다.** `after-companion-merge`의 기본은 `none`: 리뷰된 동반 PR을
    머지하면 머지된 브랜치에서 히트맵이 갱신되고(모델 없음) 그 외는 없다. 따라서 기본
    경험은 PR당 값싼 코멘트 하나와 동반 PR 하나이며, 그 이상의 모든 페이즈는 라벨, 코멘트,
    호출자 입력으로 요청된다. 체인(`full` / `automate`)은 원하는 팀을 위해 만든 대로 남는다.
    이유: 체인은 새 사용자에게 설명하기 가장 어려운 개념이었고, 기본값은 설명이 필요 없어야
    한다.
18. **전제 조건은 검증되고, 과금은 소리 내어 말한다.** 마법사는 토큰, 로그인 시크릿,
    Actions PR 설정, `sources.json`을 하나씩 안내하고 각각 검증한다 — `gh secret list`
    (이름만), Actions 권한 API(명시적 yes에 `PUT` 제안), sources 없는 모든 기능에
    `/qa-test-plan` 실행 제안 — 검증되지 않았고 미루지도 않은 항목이 있는 동안은 단계를
    닫기를 거부한다. 누가 내는지는 토큰 명령 전에 말하고, 스캐폴더가 반복하고, 모든 히트맵
    코멘트의 푸터에 인쇄된다(페이즈별 지출, 어느 시크릿).

## 3 · 단계별 전달

| 단계 | 저장소 | 내용 | 동작 변화 |
|---|---|---|---|
| A | QABuddy | `bin/pr-coverage.js`, `testPrCoverage`(48개 검사), KB 명세 §6.5 노트 + §6.8 + §6.9(en + ko), 이 RFC | 없음 — 새 파일, 새 문서 |
| B | QABuddy | 프리앰블의 Headless Mode(en + ko), start / test-plan / test-cases / exploratory / e2e-setup / e2e-pom의 게이트 편집, `headless` 픽스처 6개 | `QABUDDY_HEADLESS=1`이나 `--headless`가 아니면 없음; `/qa-test-cases`는 이제 두 모드 모두에서 §6.5 매핑 형태를 쓴다 |
| C | `qabuddy-poc-acme` | 스크래치 고객 저장소: Acme Projects 앱, 시드된 KB(AC1–AC6, TC-01–TC-04 매핑, AC5/AC6는 일부러 미매핑), 워크플로우, 프롬프트, MCP 설정; 대조 PR과 데모 PR; `kb` 페이즈 | 해당 없음(새 저장소) |
| D | `qabuddy-poc-acme` + 이 RFC | `qa:explore`, `qa:automate`, `qa:full`; 시드된 Playwright 스캐폴드; §4에 기록된 측정; Accept / Kill | 해당 없음 |

이 RFC의 어떤 것도 `main`에 제안되지 않는다. 브랜치는 개념 증명이다; 어느 부분이든 승격할지는
§4에 숫자가 생긴 뒤 Timothy가 결정한다.

## 4 · 측정과 킬 기준

데모 PR(`server.js`를 바꿔 DELETE가 204를 돌려주지만 행은 목록에 남게 함 — 픽스처 앱의 `v3`
동작이 그럴듯한 리팩터로 도착)에서:

| | 기준 | 킬 조건 |
|---|---|---|
| (a) | `touched`가 `server.js` → `projects`를 결정적으로 매핑 | 실패 — 결정적 계층이 틀렸다 |
| (b) | 실행 전 히트맵이 AC5 / AC6를 E2E와 Manual에서 `gap`으로 표시; 실행 후 AC4 at risk | 실패 — 동일 |
| (c) | 헤드리스 탐색이 3회 중 ≥ 2회 삭제 플로우에서 발견을 보고 | (c)와 (d)가 연속 3회 실행에서 모두 실패 |
| (d) | Automate 페이즈가 제목에 TC id를 담은 스펙을 생성; 데모 브랜치에서 TC-04 red | (c) 참조 |
| (e) | 비용이 캡 이내 — kb ≤ $5, explore ≤ $10, automate ≤ $20, full ≤ $30 — 그리고 벽시계 시간 ≤ 60분 | 비용 > 캡의 2× |
| (f) | 액션의 실행 파일에 `AskUserQuestion` 호출 0회 | 호출 하나라도 — 헤드리스가 질문을 흘렸다 |

### 지금까지의 결과 (단계 C, 2026-09-05, `TimothyHan/qabuddy-poc-acme`)

| 검사 | 결과 |
|---|---|
| 대조 PR #1 (README만) | `resolve` + `run`이 ~1분에 green; `touched`는 아무것도 매핑하지 않음; 모델 스텝 건너뜀; `README.md`를 미매핑으로 이름 지은 코멘트 게시; **$0** |
| #1의 `/qabuddy` 코멘트 | 두 번째 실행이 같은 코멘트를 패치(id 불변, `updated_at` 이동) — PR당 코멘트 하나 유지 |
| 데모 PR #2 (`server.js` 소프트 삭제) | `touched` → `projects` 결정적으로 (a); 시드된 히트맵 게시: AC1–AC4는 E2E + Manual에서 `partial`, AC5/AC6 `gap`, Exploratory `not run` (b, 실행 전 절반); 러너에 `poc/cloud-service`에서 QABuddy 설치, `dist/claude/setup --status` 깨끗함 |
| #2의 모델 스텝 | 지출 전에 실패: `ANTHROPIC_API_KEY` 시크릿 미설정, 그리고 액션이 GitHub App 토큰 교환을 시도(수정: `github_token` 전달) |

### 로컬 헤드리스 실행 (단계 D, Timothy의 Claude Code, `claude -p`, 로컬 심링크의 ko 스킬)

| 실행 | 결과 |
|---|---|
| `/qa-test-cases projects --update --headless` | 33턴, 231초, **$1.24**에 DONE; 질문 0, 권한 거부 0 (f); `.qa-reports/headless/qa-test-cases.json`에 Auto-decision 3개; §6.5 매핑 작성; TC-05–TC-07 추가로 AC5/AC6가 `gap`에서 `partial`로 이동 (b, kb 페이즈의 실행 후 절반); LRN-20260904-02 포착(0건 검색과 진짜 빈 상태가 같은 DOM을 렌더링) |
| `/qa-e2e-setup --headless` (`--mcp-config`로 Playwright MCP) | 52턴, 404초, **$1.60**에 DONE; 질문 0; 쿠키 인증 프로브 → storageState, 워커 2 + 의존 global-state 프로젝트(LRN-20260904-01 적용), 화이트박스 = propose(`sources.json`이 있으므로), 기능형 POM; 두 게이트 green; AUTOMATION.md와 close 파일에 Auto-decision 4개; LRN-03(`/api/reset`은 하네스 전용)과 LRN-04(테스트 가능성 갭 4개) 포착. 스캐폴드를 `qabuddy-poc-acme` main에 시드해 CI automate가 `/qa-e2e-pom`에서 시작 |
| 소프트 삭제 빌드에 대한 `/qa-exploratory projects --quick --headless --url …` (Playwright MCP) | 47턴, 260초, **$1.31**에 DONE; 질문 0; diff에서 차터 도출; **심어 둔 버그를 찾음** — BUG-001, 삭제된 행이 목록에 남음(AC4, Blocker) — 더해서 BUG-002, 중복 이름 검사가 소프트 삭제된 행을 셈(AC2/AC3); 세션을 AC 키 표와 함께 `features-kb/features/projects/exploratory/2026-09-04.md`에 영속; 스크린샷 증거 저장; 이후 히트맵이 AC2/AC3/AC4를 `#Finding` 링크와 함께 ⚠️로 표시 — (c) 3회 중 1회, (b) 실행 후 절반 |

§4 대비 로컬 집계: (a) ✓ · (b) ✓ · (c) 지금까지 1/1 · (d) CI automate 대기 · (e) 모든
로컬 페이즈가 캡에 한참 못 미침(kb $1.24 / $5, explore $1.31 / $10, setup $1.60) · (f)
헤드리스 3회 실행, 132턴에 질문 0.

### 첫 전체 CI 실행 (2026-09-05, PR #2, `/qabuddy full`, 구독 OAuth 토큰)

| | |
|---|---|
| 세션 | 세 페이즈 모두를 한 `claude-code-action` 세션으로: **222턴, $8.18, 27.5분**, 최종 결과 `success` — 그 뒤 222 > 220턴 캡이라 액션이 실패 처리, 스위트 실행 스텝은 건너뜀 |
| 게시된 히트맵 | 모든 AC에 제목에 TC id를 담은 스펙이 있음(E2E ✅ ×6, 결과 스텝을 건너뛰어 "not run"); 모든 AC에 탐색 행, **AC4 ⚠️ 발견**; 12 covered · 9 partial · 9 gap · 1 AC at risk |
| 동반 브랜치 `qabuddy/pr-2` | 30개 파일: TC-05/TC-06 추가, §6.5 매핑, 영속된 탐색 세션, BUG-001, 증명 스크린샷을 가진 login과 projects의 페이지 객체, POM 인벤토리, API 클라이언트, 픽스처, 스펙 7개, 갱신된 AUTOMATION.md. `gh pr create`는 거부됨 — 저장소가 Actions의 PR 열기를 허용하지 않았음(설정은 이후 활성화; PR #3은 손으로 열음) |
| 업로드 안 됨 | `.qa-reports` 아티팩트 — `upload-artifact@v4`는 `include-hidden-files: true`가 아니면 점 디렉터리를 건너뜀 |
| 이 실행 전의 인증 우회로 | API 키: 유효했지만 조직에 크레딧 없음(`billing_error`); 첫 OAuth 토큰: 붙여넣은 값 거부(401); 두 번째 OAuth 토큰: 작동. 실패한 시도마다 $0 |

첫 전체 실행 후 집계: (a) ✓ · (b) ✓ · (c) 2/2(로컬 + CI) · (d) TC id를 가진 스펙 ✓,
pass/fail은 결과 스텝이 실행되는 실행을 대기 · (e) `full` $8.18, $25 캡 이내 ·
(f) `AskUserQuestion`은 CLI에서 금지됨; 실행은 질문 없이 끝남.

### 페이즈 분리 전체 CI 실행 (2026-09-05, PR #2, `/qabuddy full`, 결정 11 적용)

| 페이즈 | 턴 | 비용 | 벽시계 | 질문 | 결과 |
|---|---|---|---|---|---|
| kb | 44 | $1.15 | 5분 | 0 | DONE_WITH_CONCERNS — TC-01..TC-07, 여섯 AC 모두 매핑; diff만으로 소프트 삭제 회귀를 표시 |
| explore | 62 | $1.07 | 4분 | 0 | DONE_WITH_CONCERNS — 버그를 라이브로 확인: 삭제된 프로젝트가 목록에서 사라지지 않음(AC4) |
| automate | 103 | $3.53 | 15분 | 0 | DONE — 페이지 객체, API 클라이언트, 스펙 9개, 게이트 4개 green; TC-04 / TC-07은 소프트 삭제 빌드에 대한 예상 실패로 작성 |
| **run** | **209** | **$5.75** | **25분** | **0** | 잡 green; 스위트 실행: 테스트 9개, TC-04와 TC-07 실패(회귀), 나머지 통과; 동반 PR #3 재사용; 아티팩트 업로드 |

순서 수정 후 반복(실행 33945106786): kb 50턴 / $1.26 / 6분 · explore 61 /
$1.04 / 7분 · automate 123 / $3.04 / 12분 — **$5.34, 26.5분, 질문 0**; 실행 자체가
올바른 히트맵을 게시했고(TC-04와 TC-07 red, AC 4개 at risk, 11 covered) 동반 PR #3을
재사용했다. 전체 실행 두 번, 같은 판정.

첫 페이즈 분리 실행이 게시한 히트맵은 오래된 것이었다 — 히트맵 스텝이 돌기 전에 동반 PR 스텝이
PR head를 다시 체크아웃했다(수정: 잡이 동반 브랜치에 머문다).
같은 트리와 결과에 대한 수정된 히트맵은 아티팩트에서 게시했다.

**§4 대비 집계:** (a) ✓ · (b) ✓ 전에는 AC5/AC6 gap, 후에는 AC4 ⚠️ · (c) **3/3**(로컬
1회, CI 2회) · (d) ✓ 스펙이 TC id를 담고, 데모 브랜치에서 TC-04 red · (e) ✓ `full` $5.75,
$25 캡 대비(단일 세션 $8.18), 25분 ≤ 60 · (f) ✓ 209턴에 `AskUserQuestion` 호출 0.
**어떤 킬 기준도 걸리지 않았다. 판정: 루프는 사람 없이 작동한다; `main` 승격과 제품화는
Timothy의 결정이다.**

### 재사용 워크플로우를 통해 (2026-09-05, `qabuddy-poc-acme`를 15줄 호출자로)

| 실행 | 잡 | 결과 |
|---|---|---|
| `/qabuddy full` (33947054333) | resolve 5초 · preflight 14초 · kb 6.5분 · explore 5분 ∥ automate 15분 · deliver 16초 | 벽시계 **22.5분**(순차였다면 26.5), kb $1.14 / explore $1.31 / automate $3.34 = **$5.79**, 질문 0; explore와 automate가 1초 이내 간격으로 시작; 두 트리의 3-way 머지: 83개 파일, `.jsonl` 합집합 하나, 내용 충돌 없음. 스위트는 테스트 0개를 보고 — 데모 로그인이 global setup에 닿지 않음(시크릿만; `test-user`/`test-pass` 입력으로 수정) |
| `/qabuddy automate` (33948169266) | kb 3분 · automate 17분 | kb $0.73 / automate $3.90; **테스트 14개 실행**, 소프트 삭제 빌드에서 TC-04 / TC-07 / TC-08 red, 결과가 게시된 히트맵에 반영; 머지 보고서 깨끗함 |

### 새 PR에서의 리뷰된 체인 (2026-09-05, PR #6, `main`에서 딴 브랜치)

| 단계 | 일어난 일 |
|---|---|
| #6 열림 | kb가 기본으로 실행(`default-phases: kb`); deliver가 동반 PR #8 → `demo/soft-delete-2`(KB 파일만)를 열고 #6에 알림 |
| 리뷰어가 #8 머지 | `closed` 이벤트가 워크플로우를 깨움; resolve가 동반 PR의 페이즈(`kb`)를 읽고 kb + automate 실행(explore 건너뜀 — `after-companion-merge`가 아직 `automate`, 지금은 `full`); deliver가 동반 PR #9(페이지 객체, API 클라이언트, 스펙, 갭 보고서)를 열고 알림; 히트맵: 6 covered, 1 AC at risk |
| 리뷰어가 #9 머지 | resolve가 동반 PR이 이미 자동화를 담고 있음을 확인 → 체인 완료, 다른 모든 잡 건너뜀, $0; #9 알림에 🚀 반응과 "Merged into `demo/soft-delete-2`" 줄 |

| `/qabuddy heatmap` (또는 자동화 동반 PR이 머지될 때 자동으로) | 모델 없는 갱신: diff 재매핑, 지금 상태의 브랜치에서 머지된 스위트 실행, 재게시 — **98초, $0**; 테스트 11개 실행, TC-04 여전히 red → AC4 ⚠️; `gate` advisory-passing |

preflight 경고로 기록된 교훈: `pull_request` 워크플로우는 PR 자신의 브랜치에서 실행되므로,
호출자가 추가되기 전에 딴 브랜치(PR #2)는 베이스 브랜치가 머지되기 전까지 체인이 이어질 수
없다.

### 작업 목록으로서의 동반 PR (2026-09-05, PR #6, `/qabuddy explore`)

kb 29턴 / $0.59 · explore 102턴 / $2.13 · deliver가 세션, 버그 파일, close 파일, 히트맵으로부터
동반 PR #11의 본문을 렌더링: 작성자의 수정 목록에 버그 파일 2개 + 버그 발견 3개, UX 발견
하나는 "Decide" 아래 이슈 #10(라벨 `qabuddy`, 마커로 중복 제거)이 됨, 비용을 담은 페이즈 표,
세션이 제기한 우려; #6의 알림은 같은 수정과 결정 링크를 담는다. 결정 15: 사람이 필요한
발견은 이슈가 된다(`issues-for`); 수정은 소스 브랜치에 속하고, 동반 PR은 테스트를 담는다.

**이 실행에서 나온 설계 변경(결정 11):** 페이즈당 액션 세션 하나 — `kb`, `explore`,
`automate` — 각각 자기 턴·예산 캡과 `continue-on-error`를 가져, 자동화의 캡이나 실패가
문서화 페이즈를 절대 버리지 않고, 결과, 동반 PR, 히트맵, 아티팩트 스텝은 항상 실행된다.
잡의 마지막 스텝은 페이즈별 결과를 보고하고 어느 페이즈든 실패했으면 실행을 정직하게
실패시킨다.

## 5 · 열린 질문

- **동시 PR 아래의 `learnings-log.jsonl`.** 모든 헤드리스 실행이 프로젝트 전체 로그에
  덧붙이고 동반 PR이 그 줄을 담는다. 열린 PR 열 개는 한 파일에 덧붙이는 동반 PR 열 개를
  뜻한다. 선택지: rebase-merge(사소한 충돌, 수동), PR별 샤드(`learnings-log/<pr>.jsonl`,
  업스트림 엔진 변경 필요), 또는 동반 PR에서 로그 제외(증거를 잃음). 미결.
- **탐색 영속(결정 7).** 세션을 KB에 쓰면 증거가 되지만 KB가 PR마다 자란다. 보존 규칙
  (기능당 최신 N개 유지)이나 워크플로우 아티팩트 참조가 더 나은 장기 거처일 수 있다.
- ~~동반 PR이 base를 대상으로 하는데 산출물은 head에 대해 생성됐다.~~ 해소:
  동반 PR은 소스 PR의 head 브랜치를 대상으로 한다(결정 3, 개정).
- **액션 안의 스킬 발견.** Claude Code는 `~/.claude/skills` 아래의 개인 스킬을 발견한다;
  워크플로우는 액션의 러너 스코프가 다를 경우를 대비해 저장소 변수 뒤에 프로젝트 스코프
  폴백(`.claude/skills/`로 복사)을 둔다. 단계 C에서 검증.
