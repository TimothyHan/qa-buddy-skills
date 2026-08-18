# 리스크 기반 테스트
<!-- qab: scope=qa,test-plan,test-cases,review-ticket,exploratory,sprint-status -->

모든 테스트 케이스에 **심각도**와 **우선순위** 값을 지정합니다.
이 두 가지 기준을 조합하여 테스트 공수를 배분합니다.

## 심각도 척도
<!-- qab: id=severity-scale -->

심각도는 장애가 사용자와 비즈니스에 미치는 **영향도**를 측정합니다.

| 심각도 | 정의 | 사용자 영향 예시 |
|--------|------|-----------------|
| **Blocker** | 장애 발생 시 핵심 사용자 워크플로우를 차단하거나 서버 셧다운을 유발합니다 | 로그인 불가, 핵심 기능 CRUD 불가, 일상 업무 수행 불가 |
| **Critical** | 장애 발생 시 우회 방법 없이 주요 워크플로우를 차단합니다. 매출 손실로 이어질 수 있습니다 | 로그인과 핵심 기능은 사용할 수 있지만, 주요 작업을 수행할 수 없습니다 |
| **Major** | 장애 발생 시 주요 워크플로우를 차단하지만 우회 방법이 있습니다. 장기적으로 매출 손실이 발생할 수 있습니다 | 업무를 완료할 수 있지만, 더 길고 복잡한 경로를 거쳐야 합니다 |
| **Normal** | 장애 발생 시 비주요 워크플로우를 차단하며 우회 방법이 없습니다. 비즈니스 영향은 크지 않습니다 | 엔터티 이름 변경 실패, 사소한 필드 값 오류 (치명적이지 않음) |
| **Minor** | Normal과 동일한 영향이지만 우회 방법이 있습니다. 눈에 띄는 시각적 결함이 있습니다 | 기능은 동작하지만 사용이 불편하거나 시각적 정렬이 어긋남 |
| **Trivial** | 사소한 시각적 결함 또는 텍스트 오류입니다 | 레이블 오타, 1px 정렬, 외관상 문제만 해당 |

## 우선순위 척도
<!-- qab: id=priority-scale -->

우선순위는 심각도와 영향 범위(영향받는 사용자 수)를 기반으로 **긴급도**를 측정합니다.

| 우선순위 | 기준 |
|----------|------|
| **High** | Blocker 또는 Critical 심각도이며 즉각적인 사용자 영향이 있는 경우, 또는 Major 심각도이며 영향 범위가 넓은 경우 |
| **Medium** | Major 심각도이며 영향 범위가 좁은 경우, 또는 Normal 심각도이며 즉각적인 사용자 영향이 있는 경우 |
| **Low** | Normal 심각도이며 발생 빈도가 낮은 경우, 또는 Minor/Trivial 심각도 전체 |

## 공수 배분
<!-- qab: id=effort-allocation -->

- 우선순위와 관계없이 식별된 모든 시나리오에 대해 **테스트 케이스를 작성**합니다.
- **시간이 부족할 때는** 낮은 우선순위 및 심각도의 테스트 케이스를 후순위로 둡니다.
- **Smoke test suite** = High 우선순위 테스트 케이스 전체.
- **Regression test suite** = High + Medium 우선순위 테스트 케이스 전체.
- **Full test suite** = Low 우선순위를 포함한 전체 테스트 케이스.

## 우선순위-심각도 의사결정 매트릭스
<!-- qab: id=decision-matrix -->

```
                    High Priority    Medium Priority    Low Priority
Blocker severity    ALWAYS RUN       ALWAYS RUN         ALWAYS RUN
Critical severity   ALWAYS RUN       ALWAYS RUN         RUN IF TIME
Major severity      ALWAYS RUN       RUN IF TIME        RUN IF TIME
Normal severity     RUN IF TIME      RUN IF TIME        DEPRIORITIZE
Minor severity      DEPRIORITIZE     DEPRIORITIZE       SKIP IF SHORT
Trivial severity    SKIP IF SHORT    SKIP IF SHORT      SKIP IF SHORT
```
