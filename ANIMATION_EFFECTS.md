# 애니메이션 효과 문서

## 개요
쇼다운(Showdown) 단계에서 플레이어의 성공/실패를 시각적으로 강화하는 애니메이션 효과를 구현했습니다.

---

## 🎨 성공 효과 (Success Effects)

### 1. 황금빛 펄스 애니메이션
**위치**: `.showdown-result-badge.success`

**효과**:
- 0% → 25%: 작은 크기에서 1.3배로 확대, 황금색 글로우 효과
- 25% → 50%: 1.1배로 축소, 글로우 유지
- 50% → 75%: 1.2배로 다시 확대
- 75% → 100%: 정상 크기로 복귀, 녹색 그라데이션으로 변경

**CSS**:
```css
@keyframes successPulse {
    0% {
        transform: scale(0.5);
        box-shadow: 0 0 0 rgba(212, 175, 55, 0);
        background: linear-gradient(135deg, #d4af37, #f4d03f);
    }
    25% {
        transform: scale(1.3);
        box-shadow: 0 0 40px rgba(212, 175, 55, 1), 0 0 80px rgba(212, 175, 55, 0.5);
    }
    100% {
        transform: scale(1);
        box-shadow: 0 0 15px rgba(40, 167, 69, 0.6);
        background: linear-gradient(135deg, #28a745, #20c997);
    }
}
```

**지속 시간**: 1.5초

---

### 2. 행 전체 황금빛 글로우
**위치**: `.showdown-player-row.success-effect`

**효과**:
- 플레이어 행 전체가 황금색으로 은은하게 빛남
- 테두리 색상이 황금색으로 변경
- 배경이 밝아지는 효과

**CSS**:
```css
@keyframes rowSuccessGlow {
    0%, 100% {
        background: rgba(20, 25, 30, 0.8);
        border-color: rgba(212, 175, 55, 0.3);
    }
    50% {
        background: rgba(212, 175, 55, 0.15);
        border-color: rgba(212, 175, 55, 0.8);
        box-shadow: 0 0 30px rgba(212, 175, 55, 0.4);
    }
}
```

**지속 시간**: 2초

---

### 3. 코인 터지는 효과 (Coin Burst)
**위치**: JavaScript 함수 `createCoinBurst()`

**효과**:
- 성공 배지 중심에서 12개의 황금 코인이 원형으로 퍼져나감
- 각 코인은 80-120px 거리로 무작위 확산
- 투명해지면서 사라짐

**JavaScript**:
```javascript
function createCoinBurst(targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const coinCount = 12;
    for (let i = 0; i < coinCount; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin-burst';

        const angle = (i / coinCount) * Math.PI * 2;
        const distance = 80 + Math.random() * 40;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        coin.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            --tx: ${tx}px;
            --ty: ${ty}px;
            z-index: 9999;
        `;

        document.body.appendChild(coin);

        setTimeout(() => coin.remove(), 1000);
    }
}
```

**지속 시간**: 1초

---

## ❌ 실패 효과 (Failure Effects)

### 1. 빨간 점멸 애니메이션
**위치**: `.showdown-result-badge.fail`

**효과**:
- 3번 깜빡이는 점멸 효과
- 크기가 커졌다 작아지며 강조
- 불투명도 변화로 깜빡임 효과

**CSS**:
```css
@keyframes failFlash {
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 15px rgba(220, 53, 69, 0.6);
        opacity: 1;
    }
    10%, 30%, 50% {
        transform: scale(1.1);
        box-shadow: 0 0 40px rgba(220, 53, 69, 1);
        opacity: 0.8;
    }
    20%, 40%, 60% {
        transform: scale(0.95);
        box-shadow: 0 0 5px rgba(220, 53, 69, 0.3);
        opacity: 0.6;
    }
}
```

**지속 시간**: 1초

---

### 2. 행 전체 어두워지는 효과
**위치**: `.showdown-player-row.fail-effect`

**효과**:
- 플레이어 행이 어두운 붉은색으로 변함
- 테두리가 빨간색으로 변경

**CSS**:
```css
@keyframes rowFailDarken {
    0%, 100% {
        background: rgba(20, 25, 30, 0.8);
        border-color: rgba(212, 175, 55, 0.3);
    }
    50% {
        background: rgba(80, 20, 20, 0.3);
        border-color: rgba(220, 53, 69, 0.5);
    }
}
```

**지속 시간**: 1.5초

---

### 3. 카드 회색 효과
**위치**: `.showdown-pocket-cards.failed .card`

**효과**:
- 카드가 컬러에서 흑백으로 변함
- 밝기가 감소하여 어두워짐
- 약간 회전하는 애니메이션

**CSS**:
```css
@keyframes cardFadeOut {
    0% {
        filter: grayscale(0%) brightness(1);
        transform: rotateY(0deg);
    }
    50% {
        filter: grayscale(50%) brightness(0.8);
        transform: rotateY(10deg);
    }
    100% {
        filter: grayscale(100%) brightness(0.6);
        transform: rotateY(0deg);
    }
}
```

**지속 시간**: 1초

---

## 🔧 구현 세부사항

### renderShowdown 함수 수정
**파일**: `public/game.html`

**추가된 코드**:
```javascript
// 성공 시
if (player.isCorrect) {
    resultBadge.classList.add('success');
    resultBadge.textContent = '✅';

    // 행 전체 효과
    playerRow.classList.add('success-effect');

    // 코인 터지는 효과 (0.5초 후 실행)
    setTimeout(() => {
        createCoinBurst(resultBadge);
    }, 500);
} else {
    // 실패 시
    resultBadge.classList.add('fail');
    resultBadge.textContent = '❌';

    // 행 전체 효과
    playerRow.classList.add('fail-effect');

    // 카드 회색 효과
    pocketCards.classList.add('failed');
}
```

---

## 🎯 사용 예시

### 성공 플레이어 표시
```javascript
const playerRow = document.createElement('div');
playerRow.className = 'showdown-player-row success-effect';

const badge = document.createElement('div');
badge.className = 'showdown-result-badge success';

setTimeout(() => createCoinBurst(badge), 500);
```

### 실패 플레이어 표시
```javascript
const playerRow = document.createElement('div');
playerRow.className = 'showdown-player-row fail-effect';

const pocketCards = document.querySelector('.showdown-pocket-cards');
pocketCards.classList.add('failed');
```

---

## 📊 성능 고려사항

### 최적화
- CSS 애니메이션 사용 (GPU 가속)
- JavaScript는 요소 생성만 담당
- 애니메이션 완료 후 자동 정리

### 메모리 관리
- 코인 요소는 1초 후 자동 제거
- 이벤트 리스너 없음 (메모리 누수 방지)

### 브라우저 호환성
- 모든 모던 브라우저 지원
- CSS Transform과 Animation 사용
- Fallback 없이도 기본 기능 동작

---

## 🔮 향후 개선 가능 사항

1. **사운드 효과 추가**
   - 성공: 코인 짤랑거리는 소리
   - 실패: 낙담하는 소리

2. **입자 효과 강화**
   - WebGL 기반 파티클 시스템
   - 더 많은 코인 및 불꽃 효과

3. **진동 효과** (모바일)
   - Vibration API 사용
   - 성공/실패 시 햅틱 피드백

4. **화면 전체 효과**
   - 성공: 황금빛 테두리 빛남
   - 실패: 화면 잠깐 어두워짐

---

## 📝 관련 파일

- `public/game.html` - CSS 및 JavaScript 구현
- Line 1231-1363: CSS 애니메이션 정의
- Line 2983-3011: JavaScript 효과 적용
- Line 4095-4129: `createCoinBurst()` 함수

---

**작성일**: 2025-10-16
**버전**: v2.1
