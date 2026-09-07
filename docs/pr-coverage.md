# 풀 리퀘스트 위의 QABuddy

**상태:** `poc/cloud-service` 브랜치의 개념 증명 -- 아래 내용은 모두 만들어지고 측정되었지만
아직 `main`에는 없습니다. 설계 기록: [RFC 0004](rfc/0004-headless-pr-coverage.md).

English: [pr-coverage-en.md](pr-coverage-en.md)

QABuddy는 저장소의 모든 풀 리퀘스트에서 사람 없이 실행될 수 있습니다: PR의 diff를 그
저장소 지식 베이스의 기능에 매핑하고, 테스트 케이스를 쓰거나 갱신하고, 원하면 실행 중인
앱을 탐색해 갭을 Playwright로 자동화한 뒤, **커버리지 히트맵 코멘트 하나**를 올리고 생성된
파일을 **동반 풀 리퀘스트**로 전달합니다. 사람은 두 지점에 남습니다 -- 동반 PR을 리뷰하는
것과 탐색 세션이 결정하지 못한 것을 결정하는 것 -- 그리고 봇은 절대 베이스 브랜치에 쓰지
않습니다.

---

## PR이 받는 것

| 산출물 | 위치 | 내용 |
|---|---|---|
| **커버리지 히트맵** | PR의 고정 코멘트 하나, 실행마다 제자리에서 갱신 | diff가 건드린 기능의 인수 조건마다 한 행; 열은 Unit / API / E2E / Manual / Exploratory; ✅는 디스크 위 증거가 있을 때만, 🟡 설계됐지만 증명 안 됨, 🔴 갭, ⚪ 이번엔 실행 안 함, ⚠️ 실패한 스펙 또는 탐색 발견 |
| **동반 PR** | `qabuddy/pr-<n>` → PR 자신의 브랜치 | 생성된 테스트 케이스, 매핑, 세션, 페이지 객체, 스펙; 설명은 작업 목록 -- 추가된 것, 발견 사항, *소스 브랜치에서 고칠 것*, *결정할 것*, *아직 자동화 안 된 것* |
| **알림 코멘트** | 동반 PR마다 하나 | 작성자가 고칠 것과 리뷰어가 결정할 것; 동반 PR이 머지되면 🚀와 "merged into" 줄 |
| **이슈** | `qabuddy` 라벨 | 사람이 필요한 발견마다 하나, 재실행 시 중복 대신 갱신 |
| **실행 아티팩트** | Actions → 해당 실행 | 페이즈별 실행 로그, 히트맵 JSON, Playwright 결과 |

"covered"는 선언이 아니라 증명으로 얻습니다: `test()` 제목에 테스트 케이스 id를 가진 스펙,
AC를 이름 짓는 단위 테스트 파일, 그 케이스를 실행한 저장된 QA 보고서, 또는 그 AC를 나열한
영속 탐색 세션 행. 증거 없는 테스트 케이스는 *partial*입니다. test-plan의 "파일 경로 없이
커버리지를 주장하지 않는다" 규칙을 계층마다 적용한 것입니다.

---

## 페이즈와 트리거

| 페이즈 | 세션 | 산출 | 대략 비용 |
|---|---|---|---|
| `kb` | `/qa-test-cases --update` | 모든 AC의 테스트 케이스, 계층별 추적성 매핑, 갭 분석 | ~$1, 3–6분 |
| `explore` | Playwright MCP로 실행 중인 앱에 `/qa-exploratory --quick` | AC 키 결과 표를 가진 영속 세션, 스크린샷, 버그 파일 | ~$1–2, 4–8분 |
| `automate` | `/qa-e2e-setup`(한 번) → `/qa-e2e-pom` → `/qa-e2e-write` | 라이브로 증명된 페이지 객체, 제목에 TC id를 가진 스펙, 결과를 위한 스위트 실행 | ~$3–4, 12–17분 |

각 페이즈는 자기 러너에서 자기 턴·예산 캡을 가진 별도 Claude 세션입니다; explore와
automate는 kb 뒤에 **병렬로** 실행됩니다. 데모 앱에서 전체 실행은 약 22분, $6입니다.
어떤 세션도 질문하지 않습니다: 헤드리스 모드는 모든 일시정지에서 명시된 권장안을 택하고
*Auto-decision*으로 기록합니다.

| 트리거 | 실행 |
|---|---|
| PR 열림 또는 ready for review | 호출자의 `default-phases`(기본 `kb`) |
| 라벨 `qa:explore` · `qa:automate` · `qa:full`, 또는 코멘트 `/qabuddy explore` · `automate` · `full` · `kb` | 해당 페이즈, 그 PR에서 |
| 리뷰어가 **동반 PR을 머지** | 소스 PR에서 나머지 체인(`after-companion-merge`, 기본 `full`); 자동화를 담은 동반 PR이 머지되면 종료 |
| `/qabuddy heatmap`, 또는 체인 완료 시 자동 | 모델 없는 갱신: diff 재매핑, 현재 브랜치에서 스위트 실행, 히트맵 재게시 -- 약 90초, $0 |

절대 하지 않는 것: 모든 푸시마다, 드래프트에서, 포크에서, 동반 PR 자체에서 실행. PR당
한 번에 한 실행; 새 트리거가 이전 실행을 취소합니다.

---

## 저장소에 설정하기

같은 15줄 호출자에 이르는 세 가지 길:

1. **마법사** -- `/qa-setup`이 설정 저장 후 *PR 자동화* 단계를 제안하고, 시작 명령과 URL을
   프로브하고, 스캐폴더를 실행하고, 나머지를 안내합니다.
2. **스캐폴더** --
   ```bash
   node ~/.claude/skills/qa-references/bin/pr-coverage.js init --app-start "node server.js" --app-url http://localhost:4173 --labels true
   ```
3. **직접** -- [`.github/pr-coverage/README.md`](../.github/pr-coverage/README.md)의
   호출자를 복사합니다.

**이미 이 저장소에서 QABuddy를 쓰고 있다면?** 설정은 그대로 두고 호출자만 추가됩니다.
`/qa-setup`을 다시 실행해 *유지하고 PR 자동화 설정*을 고르거나(저장소에 호출자가 없을
때만 제안됨), `/qa-setup --pr`로 바로 가거나, 위 스캐폴더를 실행하세요. 오래된 저장소가
자주 만나는 두 가지: 이 작업 이전에 만든 기능에는 `sources.json`이 없어 기능마다
`/qa-test-plan`을 한 번 실행해 쓰기 전까지 코드가 아무 기능에도 매핑되지 않으며 --
스캐폴더와 preflight가 그 기능들을 이름으로 알려줍니다; 호출자를 커밋하기 전에 딴
브랜치는 베이스를 머지하기 전까지 동반 PR 머지에 체인이 이어지지 않습니다.

**어느 QABuddy 빌드?** 아직 릴리스에는 아무것도 없습니다 -- 마법사 단계, 스캐폴더,
헤드리스 모드는 `poc/cloud-service`에서만 나옵니다. 릴리스가 담기 전까지는 그 브랜치를
받아 `node build.js all` 후 `dist/claude/setup`을 다시 실행하세요.

호출자는 *당신의* 앱을 어떻게 실행하는지만 말합니다; 잡, 프롬프트, 머지, 프리플라이트는
QABuddy의 재사용 워크플로우에 살기 때문에 QABuddy 릴리스가 곧 워크플로우 릴리스입니다:

```yaml
jobs:
  qabuddy:
    uses: TimothyHan/qa-buddy-skills/.github/workflows/pr-coverage.yml@poc/cloud-service
    with:
      app-start: "node server.js"
      app-url: "http://localhost:4173"
    secrets: inherit
```

**전제 조건** -- `preflight` 잡이 모델 지출 전에 모두 검사하고 빠진 것을 PR 코멘트로
설명합니다:

| 필요한 것 | 방법 |
|---|---|
| `.qabuddy.json` | `/qa-setup` |
| `sources.json`을 가진 기능 하나 이상(기능이 소유한 코드; KB 명세 §6.8) | `/qa-test-plan`이 씁니다 |
| 토큰 시크릿 하나 | `claude setup-token` → `gh secret set CLAUDE_CODE_OAUTH_TOKEN`(Claude 구독 과금), 또는 API 크레딧이 있는 `ANTHROPIC_API_KEY` |
| 앱 로그인(있다면) | 시크릿 `TEST_USER` / `TEST_PASS`, 공개 데모 계정이면 `test-user` / `test-pass` 입력 |
| Actions의 PR 생성 허용 | Settings → Actions → General |
| 호출자를 가진 브랜치 | 도입 후 만든 브랜치는 모두; 더 오래된 브랜치는 베이스를 머지해야 동반 체인이 트리거됨 -- preflight가 경고 |

마법사를 포함해 아무도 토큰 값을 받지 않습니다: `gh secret set`은 직접 실행합니다.

---

## 조정하기 (호출자 입력)

| 입력 | 기본 | 의미 |
|---|---|---|
| `default-phases` | `kb` | 열릴 때 실행: `kb`, `kb,explore`, `kb,automate`, `kb,explore,automate` |
| `after-companion-merge` | `full` | 동반 PR 머지 후 이어갈 것: `full`, `automate`, `none` |
| `delivery` | `companion-pr` | `commit`은 생성 파일을 PR 브랜치에 직접 푸시 -- PR 하나, 체인 없음 |
| `issues-for` | `decisions` | 이슈가 되는 발견: `decisions`, `all`(버그 포함), `none` |
| `gate-on` | `none` | `qabuddy / gate` 검사의 판정: `at-risk`, `suite`, `gaps` -- 머지를 막으려면 브랜치 보호에서 필수로 지정; 봇은 그 규칙을 절대 설정하지 않음 |
| `kb-turns` / `kb-budget` … | 80 / $5, 120 / $10, 300 / $25 | 페이즈별 캡 |
| `model` | `claude-sonnet-5` | |
| `extra-prompt` | `.github/qabuddy/extra.md` | 모든 페이즈에 덧붙는 선택적 프로젝트 지침 |
| `qabuddy-ref` | `poc/cloud-service` | 러너에 설치되는 QABuddy ref |

---

## 탐색 세션 뒤에는

세션이 발견마다 분류하고, 종류별로 후속 조치가 다릅니다:

| 발견 | 후속 | 담당 |
|---|---|---|
| 버그 | 동반 PR 설명과 알림의 *소스 브랜치에서 고칠 것*에 나열; AC에 ⚠️; 고친 뒤 `/qabuddy heatmap`이 재검증 | 작성자 |
| 새 시나리오 | 다음 kb 실행에서 테스트 케이스, 다음 automate에서 스펙 | 체인 |
| UX 우려, 누락된 요구사항 | GitHub 이슈, *결정할 것*에 링크 | 리뷰어 / 프로덕트 |
| 앱에 대한 학습 | `LRN-` 항목 -- 이후 실행이 다시 발견하지 않도록 | 자동 |

수정은 동반 PR이 아니라 소스 브랜치에 속합니다: 동반 PR은 테스트를 담고, 버그를 기록한
실패 스펙은 수정이 들어오면 *거기서* 초록이 되어야 합니다.

---

## 어떻게 만들어졌나

- **가능한 곳은 결정적으로.** `bin/pr-coverage.js`가 diff→기능 매핑(`touched`), 히트맵과
  증거 규칙(`heatmap`), 고정 코멘트(`comment`), 병렬 페이즈 트리의 3-way 합집합(`merge`),
  전제 조건 검사(`preflight`), 작업 목록(`summary`), 이슈(`issues`), 스캐폴드(`init`)를
  맡습니다. 모델은 지식 베이스와 Playwright 산출물만 만듭니다.
- **헤드리스는 포크가 아니라 모드입니다.** Tier 1 프리앰블의 *헤드리스 모드*가 모든 스킬에
  적용됩니다: 권장안을 택하고, auto-decision을 기록하고, 에스컬레이션은 `BLOCKED`로 마치고,
  `features-kb/`, `playwright/`, `.qa-reports/` 아래에만 씁니다. 대화형 동작은 그대로입니다.
- **재사용 워크플로우 하나**, `.github/workflows/pr-coverage.yml`: `resolve → preflight →
  kb → (explore ∥ automate) → deliver → gate`. 프롬프트, 렌더러, 설치 스크립트, MCP 설정은
  `.github/pr-coverage/`에 함께 있습니다.

데모 저장소(`qabuddy-poc-acme`, 삭제된 행이 목록에 남는 소프트 삭제 리팩터)에서 측정:
탐색은 매 실행 버그를 찾았고, 생성된 스위트는 정확히 삭제 의존 테스트만 빨갛게 됐으며,
천 턴이 넘는 동안 어떤 세션도 질문하지 않았습니다. 숫자와 중단 기준은 RFC 0004 §4에
있습니다.
