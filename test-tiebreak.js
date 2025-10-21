const PokerHandEvaluator = require('./pokerHandEvaluator');

// 테스트: 같은 투페어 + 같은 킥커 = 동점이어야 함
function testTwoPairTieBreak() {
    console.log('=== Two Pair Tie Break Test ===\n');

    // Player 1: Pocket KK, Community: 88QJ3
    const player1Pocket = [
        { value: 'K', suit: 'hearts' },
        { value: 'K', suit: 'diamonds' }
    ];
    const community1 = [
        { value: '8', suit: 'clubs' },
        { value: '8', suit: 'spades' },
        { value: 'Q', suit: 'hearts' },
        { value: 'J', suit: 'clubs' },
        { value: '3', suit: 'diamonds' }
    ];

    // Player 2: Pocket KK, Community: 88Q10 2
    const player2Pocket = [
        { value: 'K', suit: 'clubs' },
        { value: 'K', suit: 'spades' }
    ];
    const community2 = [
        { value: '8', suit: 'hearts' },
        { value: '8', suit: 'diamonds' },
        { value: 'Q', suit: 'clubs' },
        { value: '10', suit: 'spades' },
        { value: '2', suit: 'hearts' }
    ];

    const hand1 = PokerHandEvaluator.evaluateHand(player1Pocket, community1);
    const hand2 = PokerHandEvaluator.evaluateHand(player2Pocket, community2);

    console.log('Player 1 hand:', hand1.name);
    console.log('Player 1 kickers:', hand1.kickers);
    console.log('Player 1 cards:', hand1.cards.map(c => c.value + c.suit[0]).join(', '));
    console.log();
    console.log('Player 2 hand:', hand2.name);
    console.log('Player 2 kickers:', hand2.kickers);
    console.log('Player 2 cards:', hand2.cards.map(c => c.value + c.suit[0]).join(', '));
    console.log();

    const comparison = PokerHandEvaluator.compareHands(hand1, hand2);
    console.log('Comparison result:', comparison);
    console.log('Expected: 0 (tie)');
    console.log('Result:', comparison === 0 ? 'PASS ✓' : 'FAIL ✗');
    console.log();

    return comparison === 0;
}

// 테스트: 같은 투페어 + 다른 킥커 = 킥커 높은 쪽이 이김
function testTwoPairDifferentKicker() {
    console.log('=== Two Pair Different Kicker Test ===\n');

    // Player 1: Pocket KK, Community: 88AJ3
    const player1Pocket = [
        { value: 'K', suit: 'hearts' },
        { value: 'K', suit: 'diamonds' }
    ];
    const community1 = [
        { value: '8', suit: 'clubs' },
        { value: '8', suit: 'spades' },
        { value: 'A', suit: 'hearts' },
        { value: 'J', suit: 'clubs' },
        { value: '3', suit: 'diamonds' }
    ];

    // Player 2: Pocket KK, Community: 88Q10 2
    const player2Pocket = [
        { value: 'K', suit: 'clubs' },
        { value: 'K', suit: 'spades' }
    ];
    const community2 = [
        { value: '8', suit: 'hearts' },
        { value: '8', suit: 'diamonds' },
        { value: 'Q', suit: 'clubs' },
        { value: '10', suit: 'spades' },
        { value: '2', suit: 'hearts' }
    ];

    const hand1 = PokerHandEvaluator.evaluateHand(player1Pocket, community1);
    const hand2 = PokerHandEvaluator.evaluateHand(player2Pocket, community2);

    console.log('Player 1 hand:', hand1.name);
    console.log('Player 1 kickers:', hand1.kickers);
    console.log();
    console.log('Player 2 hand:', hand2.name);
    console.log('Player 2 kickers:', hand2.kickers);
    console.log();

    const comparison = PokerHandEvaluator.compareHands(hand1, hand2);
    console.log('Comparison result:', comparison);
    console.log('Expected: 1 (player 1 wins)');
    console.log('Result:', comparison === 1 ? 'PASS ✓' : 'FAIL ✗');
    console.log();

    return comparison === 1;
}

// 테스트: 커뮤니티 카드에 킥커가 있는 경우
function testCommunityKickerTie() {
    console.log('=== Community Kicker Tie Test ===\n');
    console.log('Community: 10 4 A 4 3');
    console.log('Player 1: 10 Q');
    console.log('Player 2: K 10');
    console.log('Expected: 동점 (둘 다 10 10 4 4 A를 사용해야 함)\n');

    // Community: 10 4 A 4 3
    const community = [
        { value: '10', suit: 'hearts' },
        { value: '4', suit: 'diamonds' },
        { value: 'A', suit: 'clubs' },
        { value: '4', suit: 'spades' },
        { value: '3', suit: 'hearts' }
    ];

    // Player 1: 10 Q
    const player1Pocket = [
        { value: '10', suit: 'clubs' },
        { value: 'Q', suit: 'diamonds' }
    ];

    // Player 2: K 10
    const player2Pocket = [
        { value: 'K', suit: 'hearts' },
        { value: '10', suit: 'spades' }
    ];

    const hand1 = PokerHandEvaluator.evaluateHand(player1Pocket, community);
    const hand2 = PokerHandEvaluator.evaluateHand(player2Pocket, community);

    console.log('Player 1 hand:', hand1.name);
    console.log('Player 1 kickers:', hand1.kickers);
    console.log('Player 1 best 5 cards:', hand1.cards.map(c => c.value + c.suit[0]).join(', '));
    console.log();
    console.log('Player 2 hand:', hand2.name);
    console.log('Player 2 kickers:', hand2.kickers);
    console.log('Player 2 best 5 cards:', hand2.cards.map(c => c.value + c.suit[0]).join(', '));
    console.log();

    const comparison = PokerHandEvaluator.compareHands(hand1, hand2);
    console.log('Comparison result:', comparison);
    console.log('Expected: 0 (tie)');
    console.log('Result:', comparison === 0 ? 'PASS ✓' : 'FAIL ✗ - BUG FOUND!');
    console.log();

    return comparison === 0;
}

// Run tests
const test1Pass = testTwoPairTieBreak();
const test2Pass = testTwoPairDifferentKicker();
const test3Pass = testCommunityKickerTie();

console.log('\n=== Summary ===');
console.log('Test 1 (Same kicker - tie):', test1Pass ? 'PASS ✓' : 'FAIL ✗');
console.log('Test 2 (Different kicker):', test2Pass ? 'PASS ✓' : 'FAIL ✗');
console.log('Test 3 (Community kicker - tie):', test3Pass ? 'PASS ✓' : 'FAIL ✗ - BUG!');
console.log('\nAll tests passed:', test1Pass && test2Pass && test3Pass ? 'YES ✓' : 'NO ✗');
