// 동점자가 있을 때 순위 판정 로직 테스트
const PokerHandEvaluator = require('./pokerHandEvaluator');

function testRankingLogic() {
    console.log('=== Ranking Logic Test with Ties ===\n');

    // 3명의 플레이어
    // Player 1: 최고 (AA)
    // Player 2 & 3: 동점 2위 (KK)

    const community = [
        { value: '10', suit: 'hearts' },
        { value: '5', suit: 'diamonds' },
        { value: '3', suit: 'clubs' },
        { value: '7', suit: 'spades' },
        { value: '2', suit: 'hearts' }
    ];

    const player1Pocket = [
        { value: 'A', suit: 'hearts' },
        { value: 'A', suit: 'diamonds' }
    ];

    const player2Pocket = [
        { value: 'K', suit: 'clubs' },
        { value: 'K', suit: 'spades' }
    ];

    const player3Pocket = [
        { value: 'K', suit: 'hearts' },
        { value: 'K', suit: 'diamonds' }
    ];

    const hand1 = PokerHandEvaluator.evaluateHand(player1Pocket, community);
    const hand2 = PokerHandEvaluator.evaluateHand(player2Pocket, community);
    const hand3 = PokerHandEvaluator.evaluateHand(player3Pocket, community);

    const playerHands = [
        { playerId: 1, username: 'Player1', hand: hand1 },
        { playerId: 2, username: 'Player2', hand: hand2 },
        { playerId: 3, username: 'Player3', hand: hand3 }
    ];

    const rankings = PokerHandEvaluator.rankHands(playerHands);

    console.log('Rankings:');
    rankings.forEach(r => {
        console.log(`  ${r.username}: rank ${r.rank}, ${r.hand.name}, tied: ${r.tied}`);
    });
    console.log();

    // 현재 로직 시뮬레이션
    const totalPlayers = rankings.length;
    console.log('Current logic simulation:');
    rankings.forEach(player => {
        const rank = player.rank;
        const expectedStars = totalPlayers - rank + 1;
        console.log(`  ${player.username}: rank ${rank} → expects ${expectedStars}★`);
    });
    console.log();

    // 문제점 분석
    console.log('Analysis:');
    console.log('  Player1: rank 1 → expects 3★ ✓');
    console.log('  Player2: rank 2 → expects 2★ ?');
    console.log('  Player3: rank 2 → expects 2★ ?');
    console.log();
    console.log('Problem: 두 명이 모두 rank 2이고 둘 다 2★를 기대함');
    console.log('         하지만 실제로는 한 명만 2★를 받을 수 있음!');
    console.log();
    console.log('Expected behavior:');
    console.log('  - Player2와 Player3는 공동 2위로 "둘 다" 성공해야 함');
    console.log('  - 또는 동점자는 특별한 검증 로직이 필요함');
}

testRankingLogic();
