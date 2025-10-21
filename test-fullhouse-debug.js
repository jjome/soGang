const PokerHandEvaluator = require('./pokerHandEvaluator');

// KKK QQQ 2 상황 디버그
const hand = PokerHandEvaluator.evaluateHand(
    [{ value: 'K', suit: 'hearts' }, { value: 'K', suit: 'diamonds' }],
    [{ value: 'K', suit: 'clubs' }, { value: 'Q', suit: 'spades' }, { value: 'Q', suit: 'hearts' }, { value: 'Q', suit: 'clubs' }, { value: '2', suit: 'diamonds' }]
);

console.log('Hand:', hand.name);
console.log('Kickers:', hand.kickers);
console.log('Cards:', hand.cards.map(c => c.value + c.suit[0]).join(', '));
console.log('\nExpected: QQQ KK (kickers: [12, 13])');
console.log('Actual kickers:', hand.kickers);
console.log('Trip value should be Q(12), Pair value should be K(13)');
