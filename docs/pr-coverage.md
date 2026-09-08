# CI에서 QABuddy

0.9.0부터 실험적으로 제공합니다. 대화형 스킬은 그대로이고, 아래 내용은 데모 저장소 하나에서
확인한 것입니다. 설계 기록은 [RFC 0004](rfc/0004-headless-pr-coverage-ko.md)에 있습니다.
English: [pr-coverage-en.md](pr-coverage-en.md)

PR을 열면 QABuddy가 그 PR이 무엇을 바꿨는지 보고, 그 코드를 담당하는 기능의 인수 조건을
찾아, 어떤 조건에 테스트 커버리지가 있고 어떤 조건이 비어 있는지 코멘트 하나로 보여 줍니다.
비어 있는 조건이 있으면 테스트 케이스를 쓰고, 원하면 앱을 직접 돌려 보고 Playwright
테스트까지 만들어 별도 PR로 올립니다. 판단은 사람이 합니다. 그 PR을 머지할지, 탐색에서
나온 발견을 어떻게 할지는 QABuddy가 정하지 않습니다.

무엇을 테스트할지는 모델이 짐작하지 않습니다. 기능마다 `sources.json`에 "이 기능이 소유한
코드"가 적혀 있고, diff는 그 파일을 통해 기능과 인수 조건으로 이어집니다. 그 기능이 이미
가진 테스트 케이스, 지난 탐색 세션, 실행에서 쌓인 학습이 다음에 쓸 것을 정합니다. 그리고
"테스트 커버리지"라는 말은 디스크에 증거가 있을 때만 씁니다.

---

## PR에 무엇이 올라오나

**코멘트 하나.** 실행할 때마다 같은 코멘트가 제자리에서 갱신됩니다. 데모 저장소의 실제
코멘트에서 세 줄만 옮기면 이렇습니다.

| AC | Unit | API | E2E | Manual | Exploratory |
|---|---|---|---|---|---|
| **AC1** — A user can sign in with valid credentials … | 🔴 | 🔴 | ✅ TC-01 · PASS | 🟡 TC-01 | ⚪ |
| ⚠️ **AC4** — A user can delete a project … no longer appears in the list. | 🟡 | 🔴 | ⚠️ ✅ TC-04 · FAIL | 🟡 TC-04 | ⚪ |
| **AC6** — With zero projects, the page shows a "No projects yet" message … | 🔴 | 🔴 | ✅ TC-07 · not run | 🟡 TC-07 | ⚪ |

행은 인수 조건, 열은 테스트 계층입니다. 칸의 뜻은 다섯 가지뿐입니다.

- ✅ 커버됨. 그 조건을 검증하는 파일이 실제로 있습니다. 스펙이면 실행 결과까지 붙습니다.
- 🟡 설계는 됐지만 증명은 안 됨. 테스트 케이스는 있는데 그걸 실행한 파일이나 보고서가 없습니다.
- 🔴 아무것도 없음.
- ⚪ 이번 실행에서 그 계층을 돌리지 않음.
- ⚠️ 실패한 스펙이 있거나 탐색에서 발견이 나온 조건. 위 표의 AC4가 그렇습니다.

코멘트 아래 접힌 "Evidence"에 칸마다 어느 파일이 근거인지 적혀 있습니다. 마지막 줄에는
이번 실행이 얼마를 썼고 어느 시크릿으로 냈는지가 있습니다.

**PR 하나.** 생성된 파일은 `qabuddy/pr-<번호>` 브랜치에 담겨, 원래 PR의 브랜치를 향한
PR로 올라옵니다. 이 PR을 "동반 PR"이라고 부릅니다. 설명은 할 일 목록입니다. 역시 데모
저장소에서 가져온 것입니다.

> **Fix on `demo/soft-delete-2` (author)**
> - [ ] **BUG-001** (P1) — Deleted projects remain in the list after a reload
> - [ ] **BUG-002** (Normal) — No error toast when Create is rejected for a soft-deleted project's name
>
> Then comment `/qabuddy heatmap` on #6 to re-verify. Keep the fix on the source branch — this PR carries the tests, and the failing spec should turn green there.
>
> **Decide (reviewer)**
> - [ ] issues/10 — Escape does not close the delete-confirmation dialog

버그는 작성자가 원래 브랜치에서 고칩니다. 동반 PR에는 테스트가 들어 있으니, 고치고 나면
빨갛던 스펙이 거기서 초록이 됩니다. 사람이 결정해야 하는 발견은 GitHub 이슈가 되고, 다시
실행해도 같은 이슈가 갱신될 뿐 중복되지 않습니다.

**알림 하나.** 원래 PR에 "테스트를 담은 PR을 열었다"는 코멘트가 달립니다. 고칠 것과 결정할
것이 요약돼 있고, 동반 PR을 머지하면 🚀와 "merged into" 줄이 붙습니다.

---

## 첫 실행

1. **먼저 지식 베이스를 만듭니다. 이 단계는 필수입니다.** PR에서 바뀐 코드를 기능과 인수
   조건에 연결하려면 기능마다 `feature.md`와 `sources.json`이 있어야 하고, 그 파일은
   `/qa-test-plan`이 씁니다. CI는 이 파일을 만들지 않습니다. 로컬에서 기능마다 한 번씩
   실행하고, 결과인 `features-kb/`를 커밋해서 베이스 브랜치에 머지해 두세요.

   ```
   /qa-test-plan PROJ-123        # Jira 키, 또는 스펙 모드면 기능 슬러그
   ```

   지식 베이스가 비어 있으면 `preflight`가 모델을 부르지 않고 "시작할 수 없음" 코멘트를
   남깁니다. `sources.json`이 없는 기능은 어떤 변경에도 매핑되지 않아 코멘트가 비어
   나옵니다.

2. `.github/workflows/qabuddy.yml`을 만들고 아래를 붙여 넣습니다. 앱을 어떻게 띄우는지만
   바꾸면 됩니다. 나머지는 QABuddy 쪽 워크플로우가 맡습니다.

   ```yaml
   name: QABuddy
   on:
     pull_request:
       types: [opened, ready_for_review, labeled, closed]
     issue_comment:
       types: [created]
   permissions:
     contents: write
     pull-requests: write
     issues: write
   jobs:
     qabuddy:
       uses: TimothyHan/qa-buddy-skills/.github/workflows/qa-buddy-pr.yml@v0.9.1
       with:
         app-start: "node server.js"
         app-url: "http://localhost:4173"
       secrets: inherit
   ```

   손으로 쓰기 싫으면 `/qa-setup --pr`을 실행하세요. 시작 명령과 URL을 찾아 주고, 아래
   단계를 하나씩 확인해 줍니다. 터미널이 편하면 이것도 됩니다.

   ```bash
   node ~/.claude/skills/qa-references/bin/pr-coverage.js init --app-start "node server.js" --app-url http://localhost:4173 --labels true
   ```

3. 토큰을 저장소 시크릿으로 넣습니다. 이 토큰으로 비용이 나갑니다. 누가 내는지는 아래
   "비용과 계정"을 보세요.

   ```bash
   claude setup-token
   ```

   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN
   ```

   마법사를 포함해 QABuddy는 토큰 값을 받지 않습니다. `gh secret set`은 직접 실행합니다.

4. 앱에 로그인이 있으면 `TEST_USER`와 `TEST_PASS`도 시크릿으로 넣습니다.

5. 저장소 설정에서 Actions가 PR을 만들 수 있게 켭니다. Settings → Actions → General →
   "Allow GitHub Actions to create and approve pull requests".

6. PR을 엽니다. 첫 잡 `preflight`가 위 다섯 가지를 모델을 부르기 전에 검사하고, 빠진 것이
   있으면 무엇을 어떻게 고칠지 코멘트로 알려 줍니다.

여기서 `qabuddy.yml`은 여러분 저장소에 있고, 실제 잡은 QABuddy 저장소의
`qa-buddy-pr.yml@v0.9.1`에 있습니다. 러너가 그 태그의 QABuddy를 직접 설치하므로 여러분
머신에 QABuddy가 어떤 버전으로 깔려 있든 상관없습니다. 로컬 버전이 필요한 건 `/qa-setup`과
`init` 명령뿐이고, 0.9.0 이상이면 됩니다.

---

## 언제 돌고 언제 안 도나

기본은 조용합니다. PR을 열거나 ready for review로 바꾸면 `kb` 페이즈 하나만 돕니다. 테스트
케이스를 쓰고 코멘트와 동반 PR을 올리는 데 1달러쯤, 몇 분 걸립니다. 그게 끝입니다.

더 원하면 PR에서 요청합니다. 라벨 `qa:explore`, `qa:automate`, `qa:full`을 붙이거나,
`/qabuddy explore`, `/qabuddy automate`, `/qabuddy full`, `/qabuddy kb`라고 코멘트를 답니다.

동반 PR을 머지하면 코멘트가 다시 계산됩니다. 모델을 부르지 않아서 90초, 0달러입니다.
`/qabuddy heatmap`이라고 코멘트를 달아도 같은 일이 일어납니다. 버그를 고친 뒤 확인할 때
쓰세요.

머지한 뒤에 다음 페이즈까지 자동으로 이어가고 싶으면 호출자에
`after-companion-merge: full`을 적습니다. 그러면 kb 동반 PR을 리뷰하고 머지할 때 탐색과
자동화가 돌고, 그 결과가 두 번째 동반 PR로 옵니다. 자동화를 담은 동반 PR이 머지되면
거기서 멈춥니다.

**돌지 않는 경우.** 푸시할 때마다 돌지 않습니다. 드래프트 PR, 포크에서 온 PR, 동반 PR
자체에서도 돌지 않습니다. PR 하나에 실행은 한 번에 하나이고, 새로 요청하면 이전 실행은
취소됩니다.

---

## 세 페이즈

| 페이즈 | 하는 일 | 대략 |
|---|---|---|
| `kb` | `/qa-test-cases --update`. 인수 조건마다 테스트 케이스, 계층별 매핑, 갭 분석 | $1, 3~6분 |
| `explore` | `/qa-exploratory --quick`. 실행 중인 앱을 Playwright MCP로 직접 탐색. 결과 표, 스크린샷, 버그 파일 | $1~2, 4~8분 |
| `automate` | `/qa-e2e-setup`(처음 한 번) → `/qa-e2e-pom` → `/qa-e2e-write`. 페이지 객체와 스펙을 만들고 스위트를 실행 | $3~4, 12~17분 |

페이즈마다 별도의 Claude 세션이 자기 러너에서 돌고, 턴 수와 예산에 상한이 있습니다.
explore와 automate는 kb 뒤에 나란히 돕니다. 데모 앱에서 셋을 다 돌리면 22분, 6달러쯤입니다.

어떤 세션도 질문하지 않습니다. 스킬이 평소에 멈춰서 물어보는 자리마다 권장안을 그대로
택하고, 그렇게 한 결정을 *Auto-decision*으로 기록해 둡니다. 판단이 필요한 일은 `BLOCKED`로
끝내고 사람에게 넘깁니다.

---

## 탐색에서 발견이 나오면

- **버그**는 동반 PR 설명과 알림에 "고칠 것"으로 오르고, 해당 조건에 ⚠️가 붙습니다.
  작성자가 원래 브랜치에서 고친 뒤 `/qabuddy heatmap`으로 확인합니다.
- **새 시나리오**는 다음 kb 실행에서 테스트 케이스가 되고, 다음 automate에서 스펙이 됩니다.
- **UX 우려나 빠진 요구사항**은 GitHub 이슈가 됩니다. 리뷰어나 프로덕트가 결정합니다.
- **앱에 대해 알게 된 것**은 `LRN-` 항목으로 남아, 다음 실행이 같은 걸 다시 찾지 않습니다.

---

## 비용과 계정

이 워크플로우는 Claude에서만 돕니다. 스킬을 Cursor나 Copilot에서 쓰더라도 CI 쪽은
`anthropics/claude-code-action`입니다.

비용은 저장한 시크릿으로 나갑니다. `claude setup-token`으로 만든 토큰은 그 토큰을 만든
사람의 Claude 구독에 과금됩니다. 개인 저장소면 그대로 쓰면 되고, 팀 저장소라면 전용 계정으로
토큰을 만들거나 크레딧이 있는 `ANTHROPIC_API_KEY`를 쓰는 편이 낫습니다.

숨기지 않습니다. `/qa-setup`은 토큰 명령을 보여 주기 전에 누가 내는지 말하고, `init`도
같은 말을 출력하고, 모든 코멘트 끝에 이번 실행의 지출과 어느 시크릿으로 냈는지가 적힙니다.

---

## 이미 QABuddy를 쓰는 저장소라면

설정은 그대로 두고 호출자만 추가하면 됩니다. `/qa-setup --pr`이 가장 빠릅니다.
`/qa-setup`을 다시 실행해도 "유지하고 PR 자동화 설정"을 고를 수 있습니다.

오래된 저장소가 자주 만나는 일 두 가지가 있습니다. 예전에 만든 기능에는 `sources.json`이
없습니다. 기능마다 `/qa-test-plan`을 한 번 돌려 결과를 머지해야 합니다. 이건 선택이 아니라
첫 실행의 1단계와 같은 필수 조건입니다. 어떤 기능이 그런지는 `init`과
preflight가 알려 줍니다. 그리고 호출자를 커밋하기 전에 만든 브랜치는 베이스를 머지하기
전까지 동반 PR 머지에 반응하지 않습니다. GitHub이 PR 워크플로우를 그 PR의 브랜치에서 읽기
때문이고, preflight가 이것도 경고합니다.

**설정 도중 마음이 바뀌면** `/qa-setup`에 "중단"이라고 답하거나 이렇게 되돌립니다.

```bash
node ~/.claude/skills/qa-references/bin/pr-coverage.js init --remove
```

호출자와 `qa:*` 라벨만 지우고 시크릿과 저장소 설정은 건드리지 않습니다. 토큰 없이 호출자만
남겨 두면 모든 PR에 "시작할 수 없음" 코멘트가 달리기 때문에, QABuddy는 그런 상태를 만들지
않습니다.

---

## 설정값

호출자의 `with:` 아래에 적습니다.

| 입력 | 기본 | 뜻 |
|---|---|---|
| `app-start`, `app-url` | | 앱을 띄우는 명령과 주소. 필수 |
| `health-path` | `/` | 앱이 떴는지 확인할 경로 |
| `install` | `npm ci` | 의존성 설치 명령 |
| `default-phases` | `kb` | PR을 열 때 도는 것. `kb,explore`, `kb,automate`, `kb,explore,automate` |
| `after-companion-merge` | `none` | 동반 PR 머지 뒤. `none`은 코멘트 갱신만, `full`과 `automate`는 나머지 페이즈 |
| `delivery` | `companion-pr` | `commit`이면 동반 PR 없이 원래 브랜치에 바로 푸시 |
| `issues-for` | `decisions` | 이슈로 만들 발견. `all`이면 버그도, `none`이면 안 만듦 |
| `gate-on` | `none` | `qabuddy / gate` 검사가 실패하는 조건. `at-risk`, `suite`, `gaps`. 머지를 막으려면 브랜치 보호에서 필수로 지정해야 하고, 그 규칙은 저장소 주인이 정합니다 |
| `kb-turns` / `kb-budget` 등 | 80 / $5, 120 / $10, 300 / $25 | 페이즈별 상한 |
| `model` | `claude-sonnet-5` | |
| `test-user`, `test-pass` | | 공개 데모 계정일 때만. 실제 로그인은 시크릿으로 |
| `extra-prompt` | `.github/qabuddy/extra.md` | 모든 페이즈에 덧붙일 프로젝트 지침 |
| `qabuddy-ref` | `v0.9.1` | 러너에 설치할 QABuddy 태그 |

---

## 더 알아보기

- 워크플로우 내부와 입력 전체: [`.github/qa-buddy-pr/README.md`](../.github/qa-buddy-pr/README.md)
- 왜 이렇게 만들었는지, 측정 결과, 중단 기준: [RFC 0004](rfc/0004-headless-pr-coverage-ko.md)
- `sources.json`과 탐색 세션 파일의 형식: 지식 베이스 명세 §6.8, §6.9
