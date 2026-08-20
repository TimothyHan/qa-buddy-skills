# 테스트 실행 순서
<!-- qab: id=sequence scope=start,test-plan -->

스프린트에서 기능이 진행되는 동안, 테스트는 아래 순서로 수행합니다:

```
개발자가 코딩을 시작합니다
  |
  |-- 코드와 함께 단위 테스트를 작성합니다 (개발자)
  |-- API 테스트를 작성합니다 (개발자 + SDT)
  |
PR을 생성합니다
  |
  |-- CI가 Unit + API + E2E 테스트를 자동으로 실행합니다 (전체 테스트, 실패 시 머지 차단)
  |-- 개발자가 로컬에서 수동 테스트 케이스를 실행합니다
  |
기능이 준비됩니다 (develop 또는 feature 브랜치에 머지 완료)
  |
  |-- SDT가 /qa-qa를 실행합니다 (테스트 케이스 실행, AC 검증, 결함 등록)
  |-- SDT가 /qa-exploratory를 수행합니다 (차터 기반 탐색)
  |-- SDT가 UAT 시나리오를 작성합니다
  |
개발자가 결함을 수정합니다
  |
  |-- SDT가 /qa-verify-fix를 실행합니다 (각 결함 수정을 재테스트하고 회귀 여부를 확인합니다)
  |
릴리스 전
  |
  |-- UAT를 실행합니다 (최종 확인)
  |-- 회귀 테스트 스위트를 실행합니다 (자동화, High + Medium 우선순위)
  |
main에 머지합니다
  |
  |-- CI가 전체 테스트 스위트를 실행합니다 (PR 및 develop과 동일한 테스트 세트)
  |-- 기능이 main에 있더라도 고객에게 릴리스하지 않을 수 있습니다
```

## 팀별 프로세스
<!-- qab: id=team-specific-processes scope=start,test-plan -->

**릴리스 워크플로우:** `features-kb/team-practices/release-workflow.md` 파일이 정의되어 있으면 참고합니다. 릴리스 동결 규칙, 마감 시간, 롤백 절차, 카나리 전략을 다룹니다.
