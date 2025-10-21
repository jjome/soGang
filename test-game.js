const PokerHandEvaluator = require('./pokerHandEvaluator');

console.log('=== SoGang Game Comprehensive Tester ===\n');

// 테스트 결과 저장
const results = {
    passed: [],
    failed: [],
    warnings: []
};

function pass(test) {
    results.passed.push(test);
    console.log('✅', test);
}

function fail(test, error) {
    results.failed.push({ test, error });
    console.log('❌', test);
    console.log('   에러:', error);
}

function warn(test, message) {
    results.warnings.push({ test, message });
    console.log('⚠️ ', test);
    console.log('   경고:', message);
}

// ============================================
// 1. Hand Evaluation Tests
// ============================================
console.log('\n[1] Hand Evaluation Tests');
console.log('─'.repeat(50));

function testHandEvaluation() {
    // Royal Flush
    try {
        const royalFlush = PokerHandEvaluator.evaluateHand(
            [{ value: 'A', suit: 'hearts' }, { value: 'K', suit: 'hearts' }],
            [{ value: 'Q', suit: 'hearts' }, { value: 'J', suit: 'hearts' }, { value: '10', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (royalFlush.name === 'Royal Flush') {
            pass('Royal Flush detection');
        } else {
            fail('Royal Flush detection', `Expected "Royal Flush", got "${royalFlush.name}"`);
        }
    } catch (e) {
        fail('Royal Flush detection', e.message);
    }

    // Straight Flush
    try {
        const straightFlush = PokerHandEvaluator.evaluateHand(
            [{ value: '9', suit: 'spades' }, { value: '8', suit: 'spades' }],
            [{ value: '7', suit: 'spades' }, { value: '6', suit: 'spades' }, { value: '5', suit: 'spades' }, { value: 'K', suit: 'hearts' }, { value: '2', suit: 'clubs' }]
        );
        if (straightFlush.name === 'Straight Flush') {
            pass('Straight Flush detection');
        } else {
            fail('Straight Flush detection', `Expected "Straight Flush", got "${straightFlush.name}"`);
        }
    } catch (e) {
        fail('Straight Flush detection', e.message);
    }

    // Four of a Kind
    try {
        const fourOfKind = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: 'K', suit: 'clubs' }, { value: 'K', suit: 'spades' }, { value: 'A', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (fourOfKind.name === 'Four of a Kind') {
            pass('Four of a Kind detection');
        } else {
            fail('Four of a Kind detection', `Expected "Four of a Kind", got "${fourOfKind.name}"`);
        }
    } catch (e) {
        fail('Four of a Kind detection', e.message);
    }

    // Full House
    try {
        const fullHouse = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: 'K', suit: 'clubs' }, { value: 'A', suit: 'spades' }, { value: 'A', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (fullHouse.name === 'Full House') {
            pass('Full House detection');
        } else {
            fail('Full House detection', `Expected "Full House", got "${fullHouse.name}"`);
        }
    } catch (e) {
        fail('Full House detection', e.message);
    }

    // Flush
    try {
        const flush = PokerHandEvaluator.evaluateHand(
            [{ value: 'A', suit: 'hearts' }, { value: 'K', suit: 'hearts' }],
            [{ value: 'Q', suit: 'hearts' }, { value: 'J', suit: 'hearts' }, { value: '9', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (flush.name === 'Flush') {
            pass('Flush detection');
        } else {
            fail('Flush detection', `Expected "Flush", got "${flush.name}"`);
        }
    } catch (e) {
        fail('Flush detection', e.message);
    }

    // Straight
    try {
        const straight = PokerHandEvaluator.evaluateHand(
            [{ value: '9', suit: 'hearts' }, { value: '8', suit: 'diamonds' }],
            [{ value: '7', suit: 'clubs' }, { value: '6', suit: 'spades' }, { value: '5', suit: 'hearts' }, { value: 'K', suit: 'clubs' }, { value: '2', suit: 'diamonds' }]
        );
        if (straight.name === 'Straight') {
            pass('Straight detection');
        } else {
            fail('Straight detection', `Expected "Straight", got "${straight.name}"`);
        }
    } catch (e) {
        fail('Straight detection', e.message);
    }

    // Three of a Kind
    try {
        const threeOfKind = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: 'K', suit: 'clubs' }, { value: 'A', suit: 'spades' }, { value: 'Q', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (threeOfKind.name === 'Three of a Kind') {
            pass('Three of a Kind detection');
        } else {
            fail('Three of a Kind detection', `Expected "Three of a Kind", got "${threeOfKind.name}"`);
        }
    } catch (e) {
        fail('Three of a Kind detection', e.message);
    }

    // Two Pair
    try {
        const twoPair = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: 'A', suit: 'clubs' }, { value: 'A', suit: 'spades' }, { value: 'Q', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (twoPair.name === 'Two Pair') {
            pass('Two Pair detection');
        } else {
            fail('Two Pair detection', `Expected "Two Pair", got "${twoPair.name}"`);
        }
    } catch (e) {
        fail('Two Pair detection', e.message);
    }

    // One Pair
    try {
        const onePair = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: 'A', suit: 'clubs' }, { value: 'Q', suit: 'spades' }, { value: 'J', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (onePair.name === 'One Pair') {
            pass('One Pair detection');
        } else {
            fail('One Pair detection', `Expected "One Pair", got "${onePair.name}"`);
        }
    } catch (e) {
        fail('One Pair detection', e.message);
    }

    // High Card
    try {
        const highCard = PokerHandEvaluator.evaluateHand(
            [{ value: 'A', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: 'Q', suit: 'clubs' }, { value: 'J', suit: 'spades' }, { value: '9', suit: 'hearts' }, { value: '2', suit: 'clubs' }, { value: '4', suit: 'diamonds' }]
        );
        if (highCard.name === 'High Card') {
            pass('High Card detection');
        } else {
            fail('High Card detection', `Expected "High Card", got "${highCard.name}"`);
        }
    } catch (e) {
        fail('High Card detection', e.message);
    }
}

testHandEvaluation();

// ============================================
// 2. Tie-Break Tests
// ============================================
console.log('\n[2] Tie-Break Tests');
console.log('─'.repeat(50));

function testTieBreaks() {
    // Same Two Pair with Same Kicker
    try {
        const hand1 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: '8', suit: 'clubs' }, { value: '8', suit: 'spades' }, { value: 'Q', suit: 'hearts' }, { value: 'J', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        const hand2 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'clubs' }, { value: 'K', suit: 'spades' }],
            [{ value: '8', suit: 'hearts' }, { value: '8', suit: 'diamonds' }, { value: 'Q', suit: 'clubs' }, { value: '10', suit: 'spades' }, { value: '2', suit: 'hearts' }]
        );
        const comparison = PokerHandEvaluator.compareHands(hand1, hand2);
        if (comparison === 0) {
            pass('Two Pair tie with same kicker');
        } else {
            fail('Two Pair tie with same kicker', `Expected 0 (tie), got ${comparison}`);
        }
    } catch (e) {
        fail('Two Pair tie with same kicker', e.message);
    }

    // Two Pair with Different Kicker
    try {
        const hand1 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: '8', suit: 'clubs' }, { value: '8', suit: 'spades' }, { value: 'A', suit: 'hearts' }, { value: 'J', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        const hand2 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'clubs' }, { value: 'K', suit: 'spades' }],
            [{ value: '8', suit: 'hearts' }, { value: '8', suit: 'diamonds' }, { value: 'Q', suit: 'clubs' }, { value: '10', suit: 'spades' }, { value: '2', suit: 'hearts' }]
        );
        const comparison = PokerHandEvaluator.compareHands(hand1, hand2);
        if (comparison === 1) {
            pass('Two Pair with better kicker wins');
        } else {
            fail('Two Pair with better kicker wins', `Expected 1, got ${comparison}`);
        }
    } catch (e) {
        fail('Two Pair with better kicker wins', e.message);
    }

    // Community Kicker Tie (6th card doesn't matter)
    try {
        const community = [
            { value: '10', suit: 'hearts' },
            { value: '4', suit: 'diamonds' },
            { value: 'A', suit: 'clubs' },
            { value: '4', suit: 'spades' },
            { value: '3', suit: 'hearts' }
        ];
        const hand1 = PokerHandEvaluator.evaluateHand(
            [{ value: '10', suit: 'clubs' }, { value: 'Q', suit: 'diamonds' }],
            community
        );
        const hand2 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: '10', suit: 'spades' }],
            community
        );
        const comparison = PokerHandEvaluator.compareHands(hand1, hand2);
        if (comparison === 0) {
            pass('Community kicker tie (6th card ignored)');
        } else {
            fail('Community kicker tie (6th card ignored)', `Expected 0 (tie), got ${comparison}`);
        }
    } catch (e) {
        fail('Community kicker tie (6th card ignored)', e.message);
    }

    // Ace-Low Straight
    try {
        const hand = PokerHandEvaluator.evaluateHand(
            [{ value: 'A', suit: 'hearts' }, { value: '2', suit: 'diamonds' }],
            [{ value: '3', suit: 'clubs' }, { value: '4', suit: 'spades' }, { value: '5', suit: 'hearts' }, { value: 'K', suit: 'clubs' }, { value: 'Q', suit: 'diamonds' }]
        );
        if (hand.name === 'Straight') {
            pass('Ace-Low Straight (A-2-3-4-5)');
        } else {
            fail('Ace-Low Straight (A-2-3-4-5)', `Expected "Straight", got "${hand.name}"`);
        }
    } catch (e) {
        fail('Ace-Low Straight (A-2-3-4-5)', e.message);
    }
}

testTieBreaks();

// ============================================
// 3. Ranking Tests
// ============================================
console.log('\n[3] Ranking Tests');
console.log('─'.repeat(50));

function testRanking() {
    // 3 players with no ties
    try {
        const community = [
            { value: '10', suit: 'hearts' },
            { value: '5', suit: 'diamonds' },
            { value: '3', suit: 'clubs' },
            { value: '7', suit: 'spades' },
            { value: '2', suit: 'hearts' }
        ];

        const hand1 = PokerHandEvaluator.evaluateHand(
            [{ value: 'A', suit: 'hearts' }, { value: 'A', suit: 'diamonds' }],
            community
        );
        const hand2 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'clubs' }, { value: 'K', suit: 'spades' }],
            community
        );
        const hand3 = PokerHandEvaluator.evaluateHand(
            [{ value: 'Q', suit: 'hearts' }, { value: 'Q', suit: 'diamonds' }],
            community
        );

        const playerHands = [
            { playerId: 1, username: 'Player1', hand: hand1 },
            { playerId: 2, username: 'Player2', hand: hand2 },
            { playerId: 3, username: 'Player3', hand: hand3 }
        ];

        const rankings = PokerHandEvaluator.rankHands(playerHands);

        if (rankings[0].rank === 1 && rankings[0].username === 'Player1' &&
            rankings[1].rank === 2 && rankings[1].username === 'Player2' &&
            rankings[2].rank === 3 && rankings[2].username === 'Player3') {
            pass('3-player ranking (no ties)');
        } else {
            fail('3-player ranking (no ties)', `Incorrect ranking: ${rankings.map(r => `${r.username}:${r.rank}`).join(', ')}`);
        }
    } catch (e) {
        fail('3-player ranking (no ties)', e.message);
    }

    // 3 players with tie for 2nd place
    try {
        const community = [
            { value: '10', suit: 'hearts' },
            { value: '5', suit: 'diamonds' },
            { value: '3', suit: 'clubs' },
            { value: '7', suit: 'spades' },
            { value: '2', suit: 'hearts' }
        ];

        const hand1 = PokerHandEvaluator.evaluateHand(
            [{ value: 'A', suit: 'hearts' }, { value: 'A', suit: 'diamonds' }],
            community
        );
        const hand2 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'clubs' }, { value: 'K', suit: 'spades' }],
            community
        );
        const hand3 = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            community
        );

        const playerHands = [
            { playerId: 1, username: 'Player1', hand: hand1 },
            { playerId: 2, username: 'Player2', hand: hand2 },
            { playerId: 3, username: 'Player3', hand: hand3 }
        ];

        const rankings = PokerHandEvaluator.rankHands(playerHands);

        if (rankings[0].rank === 1 && rankings[0].username === 'Player1' && rankings[0].tied === false &&
            rankings[1].rank === 2 && rankings[1].tied === false &&
            rankings[2].rank === 2 && rankings[2].tied === true) {
            pass('3-player ranking (2nd place tie)');
        } else {
            fail('3-player ranking (2nd place tie)',
                `Expected ranks [1,2,2] with tied [false,false,true], got: ${rankings.map(r => `${r.username}:${r.rank}:${r.tied}`).join(', ')}`);
        }
    } catch (e) {
        fail('3-player ranking (2nd place tie)', e.message);
    }

    // All players tie
    try {
        const community = [
            { value: 'A', suit: 'hearts' },
            { value: 'K', suit: 'diamonds' },
            { value: 'Q', suit: 'clubs' },
            { value: 'J', suit: 'spades' },
            { value: '10', suit: 'hearts' }
        ];

        const hand1 = PokerHandEvaluator.evaluateHand(
            [{ value: '2', suit: 'clubs' }, { value: '3', suit: 'diamonds' }],
            community
        );
        const hand2 = PokerHandEvaluator.evaluateHand(
            [{ value: '4', suit: 'hearts' }, { value: '5', suit: 'spades' }],
            community
        );
        const hand3 = PokerHandEvaluator.evaluateHand(
            [{ value: '6', suit: 'clubs' }, { value: '7', suit: 'diamonds' }],
            community
        );

        const playerHands = [
            { playerId: 1, username: 'Player1', hand: hand1 },
            { playerId: 2, username: 'Player2', hand: hand2 },
            { playerId: 3, username: 'Player3', hand: hand3 }
        ];

        const rankings = PokerHandEvaluator.rankHands(playerHands);

        if (rankings[0].rank === 1 && rankings[0].tied === false &&
            rankings[1].rank === 1 && rankings[1].tied === true &&
            rankings[2].rank === 1 && rankings[2].tied === true) {
            pass('3-player ranking (all tie)');
        } else {
            fail('3-player ranking (all tie)',
                `Expected all rank 1 with tied [false,true,true], got: ${rankings.map(r => `${r.username}:${r.rank}:${r.tied}`).join(', ')}`);
        }
    } catch (e) {
        fail('3-player ranking (all tie)', e.message);
    }
}

testRanking();

// ============================================
// 4. Edge Cases
// ============================================
console.log('\n[4] Edge Cases');
console.log('─'.repeat(50));

function testEdgeCases() {
    // Multiple valid straights - choose highest
    try {
        const hand = PokerHandEvaluator.evaluateHand(
            [{ value: '9', suit: 'hearts' }, { value: '8', suit: 'diamonds' }],
            [{ value: '7', suit: 'clubs' }, { value: '6', suit: 'spades' }, { value: '5', suit: 'hearts' }, { value: '4', suit: 'clubs' }, { value: '3', suit: 'diamonds' }]
        );
        if (hand.name === 'Straight' && hand.kickers[0] === 9) {
            pass('Multiple straights - highest chosen (9-high)');
        } else {
            fail('Multiple straights - highest chosen', `Expected Straight with kicker 9, got ${hand.name} with kicker ${hand.kickers[0]}`);
        }
    } catch (e) {
        fail('Multiple straights - highest chosen', e.message);
    }

    // Full House - correct trip/pair selection
    try {
        const hand = PokerHandEvaluator.evaluateHand(
            [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
            [{ value: 'K', suit: 'clubs' }, { value: 'Q', suit: 'spades' }, { value: 'Q', suit: 'hearts' }, { value: 'Q', suit: 'clubs' }, { value: '2', suit: 'diamonds' }]
        );
        // Should be KKK QQ (not QQQ KK) because K > Q in trip value
        if (hand.name === 'Full House' && hand.kickers[0] === 13 && hand.kickers[1] === 12) {
            pass('Full House - correct trip/pair (KKK QQ)');
        } else {
            fail('Full House - correct trip/pair', `Expected kickers [13, 12] (K,Q), got [${hand.kickers.join(', ')}]`);
        }
    } catch (e) {
        fail('Full House - correct trip/pair', e.message);
    }

    // Two Pair - choose two highest pairs
    try {
        const hand = PokerHandEvaluator.evaluateHand(
            [{ value: '2', suit: 'hearts' }, { value: '2', suit: 'diamonds' }],
            [{ value: 'K', suit: 'clubs' }, { value: 'K', suit: 'spades' }, { value: 'Q', suit: 'hearts' }, { value: 'Q', suit: 'clubs' }, { value: 'A', suit: 'diamonds' }]
        );
        // Should be KK QQ A (not KK 22 or QQ 22)
        if (hand.name === 'Two Pair' && hand.kickers[0] === 13 && hand.kickers[1] === 12 && hand.kickers[2] === 14) {
            pass('Two Pair - highest pairs chosen (KK QQ A)');
        } else {
            fail('Two Pair - highest pairs chosen', `Expected kickers [13, 12, 14], got [${hand.kickers.join(', ')}]`);
        }
    } catch (e) {
        fail('Two Pair - highest pairs chosen', e.message);
    }
}

testEdgeCases();

// ============================================
// 5. Game Flow Tests (Chip Exchange & Game End)
// ============================================
console.log('\n[5] Game Flow Tests');
console.log('─'.repeat(50));

function testGameFlow() {
    // Test: processHeistResult function
    try {
        const { processHeistResult } = require('./gangCards');

        // Test: Successful heist (vault added)
        const room1 = {
            currentVaults: 0,
            currentAlarms: 0,
            requiredVaults: 3,
            maxAlarms: 3
        };
        const result1 = processHeistResult(room1, true);
        if (room1.currentVaults === 1 && result1.gameOver === false) {
            pass('Heist success - vault added (1/3)');
        } else {
            fail('Heist success - vault added', `Expected vaults=1, gameOver=false, got vaults=${room1.currentVaults}, gameOver=${result1.gameOver}`);
        }
    } catch (e) {
        fail('Heist success - vault added', e.message);
    }

    // Test: Failed heist (alarm added)
    try {
        const { processHeistResult } = require('./gangCards');
        const room2 = {
            currentVaults: 0,
            currentAlarms: 0,
            requiredVaults: 3,
            maxAlarms: 3
        };
        const result2 = processHeistResult(room2, false);
        if (room2.currentAlarms === 1 && result2.gameOver === false) {
            pass('Heist failure - alarm added (1/3)');
        } else {
            fail('Heist failure - alarm added', `Expected alarms=1, gameOver=false, got alarms=${room2.currentAlarms}, gameOver=${result2.gameOver}`);
        }
    } catch (e) {
        fail('Heist failure - alarm added', e.message);
    }

    // Test: Victory condition (3 vaults)
    try {
        const { processHeistResult } = require('./gangCards');
        const room3 = {
            currentVaults: 2,
            currentAlarms: 1,
            requiredVaults: 3,
            maxAlarms: 3
        };
        const result3 = processHeistResult(room3, true);
        if (room3.currentVaults === 3 && result3.gameOver === true && result3.victory === true) {
            pass('Victory condition - 3 vaults collected');
        } else {
            fail('Victory condition - 3 vaults collected',
                `Expected vaults=3, gameOver=true, victory=true, got vaults=${room3.currentVaults}, gameOver=${result3.gameOver}, victory=${result3.victory}`);
        }
    } catch (e) {
        fail('Victory condition - 3 vaults collected', e.message);
    }

    // Test: Defeat condition (3 alarms)
    try {
        const { processHeistResult } = require('./gangCards');
        const room4 = {
            currentVaults: 1,
            currentAlarms: 2,
            requiredVaults: 3,
            maxAlarms: 3
        };
        const result4 = processHeistResult(room4, false);
        if (room4.currentAlarms === 3 && result4.gameOver === true && result4.victory === false) {
            pass('Defeat condition - 3 alarms triggered');
        } else {
            fail('Defeat condition - 3 alarms triggered',
                `Expected alarms=3, gameOver=true, victory=false, got alarms=${room4.currentAlarms}, gameOver=${result4.gameOver}, victory=${result4.victory}`);
        }
    } catch (e) {
        fail('Defeat condition - 3 alarms triggered', e.message);
    }

    // Test: Game continues (not yet won/lost)
    try {
        const { processHeistResult } = require('./gangCards');
        const room5 = {
            currentVaults: 1,
            currentAlarms: 1,
            requiredVaults: 3,
            maxAlarms: 3
        };
        const result5success = processHeistResult(room5, true);
        const result5fail = processHeistResult(room5, false);

        if (room5.currentVaults === 2 && room5.currentAlarms === 2 &&
            result5success.gameOver === false && result5fail.gameOver === false) {
            pass('Game continues - not yet won/lost (2V 2A)');
        } else {
            fail('Game continues - not yet won/lost',
                `Expected vaults=2, alarms=2, both gameOver=false`);
        }
    } catch (e) {
        fail('Game continues - not yet won/lost', e.message);
    }

    // Note: Chip validation requires room and player context, tested in integration tests

    // Test: Full game simulation (3 heists to victory)
    try {
        const { processHeistResult } = require('./gangCards');
        const gameRoom = {
            currentVaults: 0,
            currentAlarms: 0,
            requiredVaults: 3,
            maxAlarms: 3
        };

        // Heist 1: Success
        const h1 = processHeistResult(gameRoom, true);
        // Heist 2: Failure
        const h2 = processHeistResult(gameRoom, false);
        // Heist 3: Success
        const h3 = processHeistResult(gameRoom, true);
        // Heist 4: Success (should trigger victory)
        const h4 = processHeistResult(gameRoom, true);

        if (gameRoom.currentVaults === 3 && gameRoom.currentAlarms === 1 &&
            h4.gameOver === true && h4.victory === true) {
            pass('Full game simulation - victory after 4 heists (3V 1A)');
        } else {
            fail('Full game simulation - victory',
                `Expected 3V 1A with victory, got ${gameRoom.currentVaults}V ${gameRoom.currentAlarms}A, gameOver=${h4.gameOver}, victory=${h4.victory}`);
        }
    } catch (e) {
        fail('Full game simulation - victory', e.message);
    }

    // Test: Full game simulation (3 failures to defeat)
    try {
        const { processHeistResult } = require('./gangCards');
        const gameRoom = {
            currentVaults: 0,
            currentAlarms: 0,
            requiredVaults: 3,
            maxAlarms: 3
        };

        // All failures
        const h1 = processHeistResult(gameRoom, false);
        const h2 = processHeistResult(gameRoom, false);
        const h3 = processHeistResult(gameRoom, false);

        if (gameRoom.currentVaults === 0 && gameRoom.currentAlarms === 3 &&
            h3.gameOver === true && h3.victory === false) {
            pass('Full game simulation - defeat after 3 failures (0V 3A)');
        } else {
            fail('Full game simulation - defeat',
                `Expected 0V 3A with defeat, got ${gameRoom.currentVaults}V ${gameRoom.currentAlarms}A, gameOver=${h3.gameOver}, victory=${h3.victory}`);
        }
    } catch (e) {
        fail('Full game simulation - defeat', e.message);
    }
}

testGameFlow();

// ============================================
// Summary
// ============================================
console.log('\n' + '═'.repeat(50));
console.log('TEST SUMMARY');
console.log('═'.repeat(50));
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}`);

if (results.failed.length > 0) {
    console.log('\nFailed Tests:');
    results.failed.forEach(({ test, error }) => {
        console.log(`  - ${test}`);
        console.log(`    ${error}`);
    });
}

if (results.warnings.length > 0) {
    console.log('\nWarnings:');
    results.warnings.forEach(({ test, message }) => {
        console.log(`  - ${test}`);
        console.log(`    ${message}`);
    });
}

console.log('\n' + '═'.repeat(50));
if (results.failed.length === 0) {
    console.log('🎉 All tests passed!');
} else {
    console.log(`❌ ${results.failed.length} test(s) failed`);
    process.exit(1);
}
