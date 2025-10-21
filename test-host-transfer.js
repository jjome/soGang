const io = require('socket.io-client');

console.log('=== Host Transfer Test ===\n');

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

// 테스트 헬퍼: 랜덤 문자열 생성
function randomString(length = 8) {
    return Math.random().toString(36).substring(2, 2 + length);
}

// 테스트 헬퍼: 대기
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 메인 테스트
async function runHostTransferTests() {
    const SERVER_URL = 'http://localhost:3000';

    console.log('[1] Host Transfer on Leave Room Test');
    console.log('─'.repeat(50));

    try {
        // 3명의 소켓 생성
        const socket1 = io(SERVER_URL, { transports: ['websocket'] });
        const socket2 = io(SERVER_URL, { transports: ['websocket'] });
        const socket3 = io(SERVER_URL, { transports: ['websocket'] });

        const username1 = `Host_${randomString()}`;
        const username2 = `Player2_${randomString()}`;
        const username3 = `Player3_${randomString()}`;
        const roomName = `TestRoom_${randomString()}`;

        let roomId = null;
        let hostChangedReceived = false;
        let newHostUsername = null;

        // 연결 대기
        await Promise.all([
            new Promise(resolve => socket1.on('connect', resolve)),
            new Promise(resolve => socket2.on('connect', resolve)),
            new Promise(resolve => socket3.on('connect', resolve))
        ]);

        console.log(`[Connected] 3 clients connected`);

        // 사용자 등록
        socket1.emit('registerUser', username1);
        socket2.emit('registerUser', username2);
        socket3.emit('registerUser', username3);

        await wait(500);
        console.log(`[Registered] ${username1}, ${username2}, ${username3}`);

        // Socket1이 방 생성 (방장)
        await new Promise((resolve) => {
            socket1.on('roomCreated', (data) => {
                roomId = data.roomId;
                console.log(`[Room Created] ${roomName} (ID: ${roomId}) by ${username1}`);
                resolve();
            });
            socket1.emit('createRoom', { roomName });
        });

        // Socket2와 Socket3가 방 입장
        await new Promise((resolve) => {
            let joinedCount = 0;
            const checkJoined = () => {
                joinedCount++;
                if (joinedCount === 2) resolve();
            };

            socket2.on('joinedRoom', (data) => {
                console.log(`[Joined] ${username2} joined room`);
                checkJoined();
            });

            socket3.on('joinedRoom', (data) => {
                console.log(`[Joined] ${username3} joined room`);
                checkJoined();
            });

            socket2.emit('joinRoom', { roomId });
            socket3.emit('joinRoom', { roomId });
        });

        await wait(500);

        // Socket2와 Socket3에서 hostChanged 이벤트 리스너 등록
        socket2.on('hostChanged', (data) => {
            console.log(`[Host Changed Event] New host: ${data.newHost}`);
            hostChangedReceived = true;
            newHostUsername = data.newHost;
        });

        socket3.on('hostChanged', (data) => {
            console.log(`[Host Changed Event] New host: ${data.newHost}`);
        });

        // Socket1 (방장)이 방을 나감
        console.log(`[Leave Room] ${username1} (host) is leaving...`);
        socket1.emit('leaveRoom', { roomId });

        await wait(1000);

        // 결과 검증
        if (hostChangedReceived) {
            pass('Host transfer - hostChanged event received');
        } else {
            fail('Host transfer - hostChanged event received', 'Event was not received');
        }

        if (newHostUsername === username2) {
            pass(`Host transfer - correct new host (${username2})`);
        } else {
            fail('Host transfer - correct new host', `Expected ${username2}, got ${newHostUsername}`);
        }

        // 정리
        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();

        await wait(500);

    } catch (error) {
        fail('Host transfer on leave room', error.message);
    }

    console.log('\n[2] Host Transfer on Disconnect Test');
    console.log('─'.repeat(50));

    try {
        // 3명의 소켓 생성
        const socket1 = io(SERVER_URL, { transports: ['websocket'] });
        const socket2 = io(SERVER_URL, { transports: ['websocket'] });
        const socket3 = io(SERVER_URL, { transports: ['websocket'] });

        const username1 = `Host_${randomString()}`;
        const username2 = `Player2_${randomString()}`;
        const username3 = `Player3_${randomString()}`;
        const roomName = `TestRoom_${randomString()}`;

        let roomId = null;
        let hostChangedReceived = false;
        let newHostUsername = null;

        // 연결 대기
        await Promise.all([
            new Promise(resolve => socket1.on('connect', resolve)),
            new Promise(resolve => socket2.on('connect', resolve)),
            new Promise(resolve => socket3.on('connect', resolve))
        ]);

        console.log(`[Connected] 3 clients connected`);

        // 사용자 등록
        socket1.emit('registerUser', username1);
        socket2.emit('registerUser', username2);
        socket3.emit('registerUser', username3);

        await wait(500);
        console.log(`[Registered] ${username1}, ${username2}, ${username3}`);

        // Socket1이 방 생성 (방장)
        await new Promise((resolve) => {
            socket1.on('roomCreated', (data) => {
                roomId = data.roomId;
                console.log(`[Room Created] ${roomName} (ID: ${roomId}) by ${username1}`);
                resolve();
            });
            socket1.emit('createRoom', { roomName });
        });

        // Socket2와 Socket3가 방 입장
        await new Promise((resolve) => {
            let joinedCount = 0;
            const checkJoined = () => {
                joinedCount++;
                if (joinedCount === 2) resolve();
            };

            socket2.on('joinedRoom', (data) => {
                console.log(`[Joined] ${username2} joined room`);
                checkJoined();
            });

            socket3.on('joinedRoom', (data) => {
                console.log(`[Joined] ${username3} joined room`);
                checkJoined();
            });

            socket2.emit('joinRoom', { roomId });
            socket3.emit('joinRoom', { roomId });
        });

        await wait(500);

        // Socket2와 Socket3에서 hostChanged 이벤트 리스너 등록
        socket2.on('hostChanged', (data) => {
            console.log(`[Host Changed Event] New host: ${data.newHost}`);
            hostChangedReceived = true;
            newHostUsername = data.newHost;
        });

        socket3.on('hostChanged', (data) => {
            console.log(`[Host Changed Event] New host: ${data.newHost}`);
        });

        // Socket1 (방장)이 연결 끊김 (disconnect)
        console.log(`[Disconnect] ${username1} (host) is disconnecting...`);
        socket1.disconnect();

        await wait(1000);

        // 결과 검증
        if (hostChangedReceived) {
            pass('Host transfer on disconnect - hostChanged event received');
        } else {
            fail('Host transfer on disconnect - hostChanged event received', 'Event was not received');
        }

        if (newHostUsername === username2) {
            pass(`Host transfer on disconnect - correct new host (${username2})`);
        } else {
            fail('Host transfer on disconnect - correct new host', `Expected ${username2}, got ${newHostUsername}`);
        }

        // 정리
        socket2.disconnect();
        socket3.disconnect();

        await wait(500);

    } catch (error) {
        fail('Host transfer on disconnect', error.message);
    }

    console.log('\n[3] No Host Transfer When Non-Host Leaves');
    console.log('─'.repeat(50));

    try {
        // 3명의 소켓 생성
        const socket1 = io(SERVER_URL, { transports: ['websocket'] });
        const socket2 = io(SERVER_URL, { transports: ['websocket'] });
        const socket3 = io(SERVER_URL, { transports: ['websocket'] });

        const username1 = `Host_${randomString()}`;
        const username2 = `Player2_${randomString()}`;
        const username3 = `Player3_${randomString()}`;
        const roomName = `TestRoom_${randomString()}`;

        let roomId = null;
        let hostChangedReceived = false;

        // 연결 대기
        await Promise.all([
            new Promise(resolve => socket1.on('connect', resolve)),
            new Promise(resolve => socket2.on('connect', resolve)),
            new Promise(resolve => socket3.on('connect', resolve))
        ]);

        console.log(`[Connected] 3 clients connected`);

        // 사용자 등록
        socket1.emit('registerUser', username1);
        socket2.emit('registerUser', username2);
        socket3.emit('registerUser', username3);

        await wait(500);
        console.log(`[Registered] ${username1}, ${username2}, ${username3}`);

        // Socket1이 방 생성 (방장)
        await new Promise((resolve) => {
            socket1.on('roomCreated', (data) => {
                roomId = data.roomId;
                console.log(`[Room Created] ${roomName} (ID: ${roomId}) by ${username1}`);
                resolve();
            });
            socket1.emit('createRoom', { roomName });
        });

        // Socket2와 Socket3가 방 입장
        await new Promise((resolve) => {
            let joinedCount = 0;
            const checkJoined = () => {
                joinedCount++;
                if (joinedCount === 2) resolve();
            };

            socket2.on('joinedRoom', (data) => {
                console.log(`[Joined] ${username2} joined room`);
                checkJoined();
            });

            socket3.on('joinedRoom', (data) => {
                console.log(`[Joined] ${username3} joined room`);
                checkJoined();
            });

            socket2.emit('joinRoom', { roomId });
            socket3.emit('joinRoom', { roomId });
        });

        await wait(500);

        // 모든 소켓에서 hostChanged 이벤트 리스너 등록
        socket1.on('hostChanged', () => {
            hostChangedReceived = true;
        });
        socket2.on('hostChanged', () => {
            hostChangedReceived = true;
        });
        socket3.on('hostChanged', () => {
            hostChangedReceived = true;
        });

        // Socket3 (일반 플레이어)가 방을 나감
        console.log(`[Leave Room] ${username3} (non-host) is leaving...`);
        socket3.emit('leaveRoom', { roomId });

        await wait(1000);

        // 결과 검증
        if (!hostChangedReceived) {
            pass('No host transfer - hostChanged not triggered for non-host');
        } else {
            fail('No host transfer - hostChanged not triggered for non-host', 'Event was triggered when it should not be');
        }

        // 정리
        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();

        await wait(500);

    } catch (error) {
        fail('No host transfer for non-host', error.message);
    }
}

// 실행
(async () => {
    try {
        await runHostTransferTests();

        // 요약
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
            process.exit(0);
        } else {
            console.log(`❌ ${results.failed.length} test(s) failed`);
            process.exit(1);
        }
    } catch (error) {
        console.error('Test execution failed:', error);
        process.exit(1);
    }
})();
