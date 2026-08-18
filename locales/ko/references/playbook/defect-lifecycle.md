# 결함 생명주기
<!-- qab: scope=qa,test-plan,review-ticket,verify-fix,start -->

## 결함 유형
<!-- qab: id=defect-types -->

| 유형 | 정의 | 사용자 영향 | 발견 주체 |
|------|------|------------|----------|
| **Production bug** | 운영 환경에서 발견한 결함 | 최종 사용자에게 영향을 줍니다 | 사용자, 모니터링, 운영 환경 테스트 |
| **Pre-release bug** | 내부 테스트 중 발견한 결함 | 최종 사용자에게 영향이 없습니다 | SDT, 개발자, CI 파이프라인 |

## 결함 상태
<!-- qab: id=defect-states -->

Production bug과 Pre-release bug 모두 Jira에서 동일한 생명주기를 따릅니다:

```
New -> Issue Verified -> Investigation -> Development in Progress
  -> Code Review -> Testing -> Final Review -> Resolved -> Released -> Closed
```

| 상태 | 담당자 | 수행 내용 |
|------|--------|----------|
| **New** | 보고자 | 재현 절차, 심각도, 우선순위를 포함하여 결함을 등록합니다 |
| **Issue Verified** | 팀 (트리아지) | 결함이 유효하고 재현 가능한지 팀에서 확인합니다 |
| **Investigation** | 개발자 | 근본 원인을 조사합니다 |
| **Development in Progress** | 개발자 | 수정 작업을 진행합니다 |
| **Code Review** | 개발자 + 리뷰어 | PR을 통해 수정 코드를 리뷰합니다 |
| **Testing** | SDT 또는 개발자 | `/qa-verify-fix`로 수정 사항을 검증합니다 |
| **Final Review** | 결함 보고자 | 최초 보고자가 수정 결과를 확인합니다 |
| **Resolved** | 자동/개발자 | 수정 사항을 머지합니다 |
| **Released** | 자동/릴리스 관리자 | 수정 사항을 운영 환경에 배포합니다 |
| **Closed** | 자동/보고자 | 운영 환경에서 정상 동작을 확인합니다 |

## SLA 기대치
<!-- qab: id=sla-expectations -->

| 심각도 | 대응 시간 | 해결 목표 |
|--------|----------|----------|
| **Blocker** | 즉시 | 당일 수정 |
| **Critical** | 당일 | 현재 스프린트 내 수정 |
| **Major** | 현재 스프린트 내 | 현재 또는 다음 스프린트 내 수정 |
| **Normal** | 다음 스프린트 계획 시 | 백로그에서 우선순위 결정 |
| **Minor** | 백로그 | 여유 있을 때 처리 |
| **Trivial** | 백로그 | 여유 있을 때 처리 |

## 회귀 테스트 요구사항
<!-- qab: id=regression-test-requirements -->

| 결함 유형 | 회귀 테스트 필요 여부 | 근거 |
|----------|---------------------|------|
| **Production bug** | 예, 항상 필요 | 결함이 운영 환경까지 유출되었으므로 재발을 반드시 방지해야 합니다 |
| **Pre-release bug** | 아니오 (단, CI가 커버) | CI 파이프라인이 회귀 테스트 스위트를 실행하여 커버리지를 제공합니다 |

## 팀별 프로세스
<!-- qab: id=team-specific-processes -->

**결함 트리아지/접수:** `features-kb/team-practices/bug-triage.md` 파일이 정의되어 있으면 참고합니다. 초기 평가, 재현 절차, 심각도 지정, 트리아지 주기를 다룹니다.

**핫픽스 테스트:** `features-kb/team-practices/hotfix-testing.md` 파일이 정의되어 있으면 참고합니다. 간소화된 테스트 절차, 생략 가능 항목, 핫픽스 브랜치 전략을 다룹니다.
