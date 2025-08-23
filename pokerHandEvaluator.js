// 포커 핸드 평가 시스템
const HAND_RANKS = {
    ROYAL_FLUSH: 10,
    STRAIGHT_FLUSH: 9,
    FOUR_OF_A_KIND: 8,
    FULL_HOUSE: 7,
    FLUSH: 6,
    STRAIGHT: 5,
    THREE_OF_A_KIND: 4,
    TWO_PAIR: 3,
    ONE_PAIR: 2,
    HIGH_CARD: 1
};

const CARD_VALUES = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11,
    '10': 10, '9': 9, '8': 8, '7': 7,
    '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

// 에이스를 로우 카드로 취급하는 특수 케이스
const CARD_VALUES_ACE_LOW = {
    'A': 1, 'K': 13, 'Q': 12, 'J': 11,
    '10': 10, '9': 9, '8': 8, '7': 7,
    '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

class PokerHandEvaluator {
    // 7장의 카드(포켓 2장 + 커뮤니티 5장)에서 최고의 5장 선택
    static evaluateHand(pocketCards, communityCards) {
        const allCards = [...pocketCards, ...communityCards];
        
        // 7장 중 5장을 선택하는 모든 조합 생성
        const combinations = this.getCombinations(allCards, 5);
        
        let bestHand = null;
        let bestRank = 0;
        let bestKickers = [];
        
        for (const combo of combinations) {
            const evaluation = this.evaluateFiveCards(combo);
            
            // 더 좋은 핸드를 찾았거나, 같은 랭크일 때 킥커가 더 좋은 경우
            if (!bestHand || evaluation.rank > bestRank || 
                (evaluation.rank === bestRank && this.compareKickers(evaluation.kickers, bestKickers) > 0)) {
                bestHand = combo;
                bestRank = evaluation.rank;
                bestKickers = evaluation.kickers;
            }
        }
        
        const finalEvaluation = this.evaluateFiveCards(bestHand);
        return {
            ...finalEvaluation,
            cards: bestHand
        };
    }
    
    // 5장의 카드를 평가
    static evaluateFiveCards(cards) {
        const values = cards.map(c => CARD_VALUES[c.value]).sort((a, b) => b - a);
        const suits = cards.map(c => c.suit);
        const valueCounts = this.getValueCounts(cards);
        const suitCounts = this.getSuitCounts(cards);
        
        // 플러시 체크
        const isFlush = Object.values(suitCounts).some(count => count >= 5);
        
        // 스트레이트 체크
        const straightInfo = this.checkStraight(values);
        const isStraight = straightInfo.isStraight;
        const straightHighCard = straightInfo.highCard;
        
        // 카운트별 그룹화
        const counts = Object.values(valueCounts).sort((a, b) => b - a);
        
        // 로열 플러시
        if (isFlush && isStraight && straightHighCard === 14) {
            return {
                rank: HAND_RANKS.ROYAL_FLUSH,
                name: 'Royal Flush',
                kickers: [14, 13, 12, 11, 10]
            };
        }
        
        // 스트레이트 플러시
        if (isFlush && isStraight) {
            return {
                rank: HAND_RANKS.STRAIGHT_FLUSH,
                name: 'Straight Flush',
                kickers: [straightHighCard]
            };
        }
        
        // 포카드
        if (counts[0] === 4) {
            const quadValue = this.getValueByCount(valueCounts, 4)[0];
            const kicker = values.find(v => v !== quadValue);
            return {
                rank: HAND_RANKS.FOUR_OF_A_KIND,
                name: 'Four of a Kind',
                kickers: [quadValue, kicker]
            };
        }
        
        // 풀하우스
        if (counts[0] === 3 && counts[1] === 2) {
            const tripValue = this.getValueByCount(valueCounts, 3)[0];
            const pairValue = this.getValueByCount(valueCounts, 2)[0];
            return {
                rank: HAND_RANKS.FULL_HOUSE,
                name: 'Full House',
                kickers: [tripValue, pairValue]
            };
        }
        
        // 플러시
        if (isFlush) {
            return {
                rank: HAND_RANKS.FLUSH,
                name: 'Flush',
                kickers: values.slice(0, 5)
            };
        }
        
        // 스트레이트
        if (isStraight) {
            return {
                rank: HAND_RANKS.STRAIGHT,
                name: 'Straight',
                kickers: [straightHighCard]
            };
        }
        
        // 트리플
        if (counts[0] === 3) {
            const tripValue = this.getValueByCount(valueCounts, 3)[0];
            const kickers = values.filter(v => v !== tripValue).slice(0, 2);
            return {
                rank: HAND_RANKS.THREE_OF_A_KIND,
                name: 'Three of a Kind',
                kickers: [tripValue, ...kickers]
            };
        }
        
        // 투페어
        if (counts[0] === 2 && counts[1] === 2) {
            const pairs = this.getValueByCount(valueCounts, 2).sort((a, b) => b - a);
            const kicker = values.find(v => !pairs.includes(v));
            return {
                rank: HAND_RANKS.TWO_PAIR,
                name: 'Two Pair',
                kickers: [...pairs, kicker]
            };
        }
        
        // 원페어
        if (counts[0] === 2) {
            const pairValue = this.getValueByCount(valueCounts, 2)[0];
            const kickers = values.filter(v => v !== pairValue).slice(0, 3);
            return {
                rank: HAND_RANKS.ONE_PAIR,
                name: 'One Pair',
                kickers: [pairValue, ...kickers]
            };
        }
        
        // 하이카드
        return {
            rank: HAND_RANKS.HIGH_CARD,
            name: 'High Card',
            kickers: values.slice(0, 5)
        };
    }
    
    // 스트레이트 체크
    static checkStraight(values) {
        const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
        
        // 일반 스트레이트 체크
        for (let i = 0; i <= uniqueValues.length - 5; i++) {
            let isStraight = true;
            for (let j = 0; j < 4; j++) {
                if (uniqueValues[i + j] - uniqueValues[i + j + 1] !== 1) {
                    isStraight = false;
                    break;
                }
            }
            if (isStraight) {
                return { isStraight: true, highCard: uniqueValues[i] };
            }
        }
        
        // A-2-3-4-5 스트레이트 체크 (Wheel)
        if (uniqueValues.includes(14) && uniqueValues.includes(5) && 
            uniqueValues.includes(4) && uniqueValues.includes(3) && uniqueValues.includes(2)) {
            return { isStraight: true, highCard: 5 }; // Wheel의 하이카드는 5
        }
        
        return { isStraight: false, highCard: 0 };
    }
    
    // 값별 카운트
    static getValueCounts(cards) {
        const counts = {};
        cards.forEach(card => {
            const value = CARD_VALUES[card.value];
            counts[value] = (counts[value] || 0) + 1;
        });
        return counts;
    }
    
    // 수트별 카운트
    static getSuitCounts(cards) {
        const counts = {};
        cards.forEach(card => {
            counts[card.suit] = (counts[card.suit] || 0) + 1;
        });
        return counts;
    }
    
    // 특정 카운트를 가진 값 찾기
    static getValueByCount(valueCounts, count) {
        return Object.entries(valueCounts)
            .filter(([_, c]) => c === count)
            .map(([v, _]) => parseInt(v))
            .sort((a, b) => b - a);
    }
    
    // 조합 생성
    static getCombinations(arr, size) {
        const result = [];
        
        function combine(start, combo) {
            if (combo.length === size) {
                result.push([...combo]);
                return;
            }
            
            for (let i = start; i < arr.length; i++) {
                combo.push(arr[i]);
                combine(i + 1, combo);
                combo.pop();
            }
        }
        
        combine(0, []);
        return result;
    }
    
    // 킥커 비교 (1: a가 더 좋음, -1: b가 더 좋음, 0: 동일)
    static compareKickers(kickersA, kickersB) {
        for (let i = 0; i < Math.min(kickersA.length, kickersB.length); i++) {
            if (kickersA[i] > kickersB[i]) return 1;
            if (kickersA[i] < kickersB[i]) return -1;
        }
        return 0;
    }
    
    // 두 핸드 비교 (1: hand1이 더 좋음, -1: hand2가 더 좋음, 0: 동일)
    static compareHands(hand1, hand2) {
        if (hand1.rank > hand2.rank) return 1;
        if (hand1.rank < hand2.rank) return -1;
        return this.compareKickers(hand1.kickers, hand2.kickers);
    }
    
    // 핸드 강도를 1-10 스케일로 변환 (칩 선택을 위함)
    static getHandStrength(hand) {
        // 기본 강도는 핸드 랭크를 기반으로
        let strength = hand.rank;
        
        // 킥커를 고려한 미세 조정
        if (hand.rank === HAND_RANKS.HIGH_CARD) {
            // 하이카드의 경우 킥커가 매우 중요
            const highCard = hand.kickers[0];
            strength += (highCard - 2) / 13 * 0.9; // 0.0 ~ 0.9 추가
        } else if (hand.rank === HAND_RANKS.ONE_PAIR) {
            // 원페어의 경우 페어 값이 중요
            const pairValue = hand.kickers[0];
            strength += (pairValue - 2) / 13 * 0.9;
        }
        
        return Math.min(10, strength);
    }
    
    // 여러 플레이어의 핸드를 순위별로 정렬
    static rankHands(playerHands) {
        // playerHands: [{playerId, hand}, ...]
        const sorted = playerHands.sort((a, b) => this.compareHands(b.hand, a.hand));
        
        // 동점자 처리
        const rankings = [];
        let currentRank = 1;
        
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && this.compareHands(sorted[i].hand, sorted[i-1].hand) === 0) {
                // 이전 플레이어와 동점
                rankings.push({
                    ...sorted[i],
                    rank: rankings[i-1].rank,
                    tied: true
                });
            } else {
                // 새로운 순위
                rankings.push({
                    ...sorted[i],
                    rank: currentRank,
                    tied: false
                });
            }
            
            // 다음 순위 계산
            if (i === sorted.length - 1 || this.compareHands(sorted[i].hand, sorted[i+1].hand) !== 0) {
                currentRank = i + 2;
            }
        }
        
        return rankings;
    }
}

module.exports = PokerHandEvaluator;