console.log('=== Host Transfer Unit Test ===\n');

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
// 1. Host Transfer Logic Tests
// ============================================
console.log('[1] Host Transfer Logic Tests');
console.log('─'.repeat(50));

function testHostTransferLogic() {
    // Test 1: Host leaves, next player becomes host
    try {
        const mockRoom = {
            host: 'Player1',
            players: new Map([
                ['socket1', { username: 'Player1', isHost: true }],
                ['socket2', { username: 'Player2', isHost: false }],
                ['socket3', { username: 'Player3', isHost: false }]
            ])
        };

        // Simulate Player1 (host) leaving
        const leavingUsername = 'Player1';
        mockRoom.players.delete('socket1');

        // Host transfer logic
        let newHostAssigned = false;
        if (mockRoom.host === leavingUsername) {
            const newHost = mockRoom.players.values().next().value;
            if (newHost) {
                mockRoom.host = newHost.username;
                newHost.isHost = true;
                newHostAssigned = true;
            }
        }

        if (newHostAssigned && mockRoom.host === 'Player2') {
            pass('Host transfer - next player becomes host (Player2)');
        } else {
            fail('Host transfer - next player becomes host',
                `Expected Player2, got ${mockRoom.host}`);
        }

        // Verify new host has isHost flag
        const newHostPlayer = Array.from(mockRoom.players.values()).find(p => p.username === mockRoom.host);
        if (newHostPlayer && newHostPlayer.isHost === true) {
            pass('Host transfer - new host has isHost flag');
        } else {
            fail('Host transfer - new host has isHost flag',
                `isHost flag not set correctly`);
        }

    } catch (e) {
        fail('Host transfer - next player becomes host', e.message);
    }

    // Test 2: Non-host leaves, host remains unchanged
    try {
        const mockRoom = {
            host: 'Player1',
            players: new Map([
                ['socket1', { username: 'Player1', isHost: true }],
                ['socket2', { username: 'Player2', isHost: false }],
                ['socket3', { username: 'Player3', isHost: false }]
            ])
        };

        // Simulate Player3 (non-host) leaving
        const leavingUsername = 'Player3';
        mockRoom.players.delete('socket3');

        // Host transfer logic
        let newHostAssigned = false;
        if (mockRoom.host === leavingUsername) {
            const newHost = mockRoom.players.values().next().value;
            if (newHost) {
                mockRoom.host = newHost.username;
                newHost.isHost = true;
                newHostAssigned = true;
            }
        }

        if (!newHostAssigned && mockRoom.host === 'Player1') {
            pass('No host transfer - host unchanged when non-host leaves');
        } else {
            fail('No host transfer - host unchanged when non-host leaves',
                `Host should remain Player1, got ${mockRoom.host}`);
        }

    } catch (e) {
        fail('No host transfer - host unchanged when non-host leaves', e.message);
    }

    // Test 3: Sequential host transfers
    try {
        const mockRoom = {
            host: 'Player1',
            players: new Map([
                ['socket1', { username: 'Player1', isHost: true }],
                ['socket2', { username: 'Player2', isHost: false }],
                ['socket3', { username: 'Player3', isHost: false }],
                ['socket4', { username: 'Player4', isHost: false }]
            ])
        };

        // First transfer: Player1 leaves -> Player2 becomes host
        mockRoom.players.delete('socket1');
        if (mockRoom.host === 'Player1') {
            const newHost = mockRoom.players.values().next().value;
            if (newHost) {
                mockRoom.host = newHost.username;
                newHost.isHost = true;
            }
        }

        const firstNewHost = mockRoom.host;

        // Second transfer: Player2 leaves -> Player3 becomes host
        mockRoom.players.delete('socket2');
        if (mockRoom.host === 'Player2') {
            const newHost = mockRoom.players.values().next().value;
            if (newHost) {
                mockRoom.host = newHost.username;
                newHost.isHost = true;
            }
        }

        const secondNewHost = mockRoom.host;

        if (firstNewHost === 'Player2' && secondNewHost === 'Player3') {
            pass('Sequential host transfer - Player1 → Player2 → Player3');
        } else {
            fail('Sequential host transfer',
                `Expected Player2 → Player3, got ${firstNewHost} → ${secondNewHost}`);
        }

    } catch (e) {
        fail('Sequential host transfer', e.message);
    }

    // Test 4: Last player leaves (room should be deleted)
    try {
        const mockRoom = {
            host: 'Player1',
            players: new Map([
                ['socket1', { username: 'Player1', isHost: true }]
            ])
        };

        // Player1 (last player) leaves
        mockRoom.players.delete('socket1');

        // Host transfer should not happen (room empty)
        let hostTransferAttempted = false;
        if (mockRoom.players.size > 0) {
            if (mockRoom.host === 'Player1') {
                const newHost = mockRoom.players.values().next().value;
                if (newHost) {
                    hostTransferAttempted = true;
                }
            }
        }

        if (!hostTransferAttempted && mockRoom.players.size === 0) {
            pass('Last player leaves - no host transfer (room empty)');
        } else {
            fail('Last player leaves - no host transfer',
                `Host transfer should not occur when room is empty`);
        }

    } catch (e) {
        fail('Last player leaves - no host transfer', e.message);
    }

    // Test 5: Host transfer preserves player order
    try {
        const mockRoom = {
            host: 'Alice',
            players: new Map([
                ['socket1', { username: 'Alice', isHost: true, joinedAt: 1000 }],
                ['socket2', { username: 'Bob', isHost: false, joinedAt: 2000 }],
                ['socket3', { username: 'Charlie', isHost: false, joinedAt: 3000 }]
            ])
        };

        // Alice (host) leaves
        mockRoom.players.delete('socket1');

        // Get first player (should be Bob, who joined first after Alice)
        const firstRemainingPlayer = mockRoom.players.values().next().value;

        if (mockRoom.host === 'Alice') {
            const newHost = mockRoom.players.values().next().value;
            if (newHost) {
                mockRoom.host = newHost.username;
                newHost.isHost = true;
            }
        }

        // Bob should be the new host (first in the remaining players)
        if (mockRoom.host === 'Bob' && firstRemainingPlayer.username === 'Bob') {
            pass('Host transfer - preserves player order (first remaining player)');
        } else {
            fail('Host transfer - preserves player order',
                `Expected Bob (first remaining), got ${mockRoom.host}`);
        }

    } catch (e) {
        fail('Host transfer - preserves player order', e.message);
    }
}

testHostTransferLogic();

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
