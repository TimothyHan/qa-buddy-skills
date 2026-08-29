# 우리 팀 결제 테스트 방법론
<!-- qab: scope=qa tier=should -->

## 환불은 항상 이중 검증
<!-- qab: id=refund-double-check -->
환불 트랜잭션은 API 응답 확인 후 원장 조회로 이중 검증한다.

## 부분 환불은 잔액 경계를 본다
<!-- qab: id=partial-refund-boundary -->
부분 환불 테스트는 0원·전액·전액+1원의 세 경계를 반드시 포함한다.
