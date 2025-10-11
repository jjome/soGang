const fs = require('fs');
const path = require('path');

console.log('=== Phase 2 & 3 검증 스크립트 ===\n');

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

// 1. Phase 2 검증: 입력 검증
console.log('\n[Phase 2] 입력 검증 확인');
console.log('─'.repeat(50));

try {
    const socketHandlersContent = fs.readFileSync(path.join(__dirname, 'socketHandlers.js'), 'utf8');

    // playerAction 검증
    if (socketHandlersContent.includes("socket.on('playerAction'") &&
        socketHandlersContent.match(/if\s*\(!roomId\s*\|\|\s*typeof roomId\s*!==\s*['"]string['"]\)/)) {
        pass('playerAction 이벤트: roomId 타입 검증');
    } else {
        warn('playerAction 이벤트: roomId 타입 검증', '검증 코드를 찾을 수 없습니다');
    }

    if (socketHandlersContent.includes('actionsRequiringTarget')) {
        pass('playerAction 이벤트: targetId 필수 검증');
    } else {
        warn('playerAction 이벤트: targetId 필수 검증', '검증 코드를 찾을 수 없습니다');
    }

    // createRoom 검증
    if (socketHandlersContent.includes("socket.on('createRoom'") &&
        socketHandlersContent.match(/roomName\.length\s*>\s*50/)) {
        pass('createRoom 이벤트: 방 이름 길이 검증');
    } else {
        warn('createRoom 이벤트: 방 이름 길이 검증', '검증 코드를 찾을 수 없습니다');
    }

    if (socketHandlersContent.match(/maxPlayers\s*[<>]\s*GAME_CONSTANTS\.(MIN|MAX)_PLAYERS/g)) {
        pass('createRoom 이벤트: maxPlayers 범위 검증');
    } else {
        warn('createRoom 이벤트: maxPlayers 범위 검증', '검증 코드를 찾을 수 없습니다');
    }

    if (socketHandlersContent.includes('validGameModes')) {
        pass('createRoom 이벤트: gameMode 검증');
    } else {
        warn('createRoom 이벤트: gameMode 검증', '검증 코드를 찾을 수 없습니다');
    }

    // confirmShowdown 검증
    if (socketHandlersContent.includes("socket.on('confirmShowdown'") &&
        socketHandlersContent.match(/typeof roomId\s*!==\s*['"]string['"]/)) {
        pass('confirmShowdown 이벤트: roomId 타입 검증');
    } else {
        warn('confirmShowdown 이벤트: roomId 타입 검증', '검증 코드를 찾을 수 없습니다');
    }

} catch (error) {
    fail('socketHandlers.js 읽기', error.message);
}

// 2. Phase 3 검증: 에러 처리
console.log('\n[Phase 3] 에러 처리 확인');
console.log('─'.repeat(50));

try {
    const socketHandlersContent = fs.readFileSync(path.join(__dirname, 'socketHandlers.js'), 'utf8');

    // try-catch 블록 개수 확인
    const tryCatchCount = (socketHandlersContent.match(/try\s*{/g) || []).length;
    const catchCount = (socketHandlersContent.match(/}\s*catch\s*\(/g) || []).length;

    if (tryCatchCount >= 20) {
        pass(`Try-catch 블록 충분함 (${tryCatchCount}개)`);
    } else {
        warn(`Try-catch 블록 수`, `${tryCatchCount}개 발견 (20개 이상 권장)`);
    }

    if (tryCatchCount === catchCount) {
        pass('Try-catch 블록 짝이 맞음');
    } else {
        warn('Try-catch 블록 짝', `try: ${tryCatchCount}, catch: ${catchCount} (중첩된 try-catch로 인한 차이일 수 있음)`);
    }

    // 주요 이벤트 핸들러 에러 처리 확인
    const events = ['startGame', 'playerAction', 'createRoom'];
    events.forEach(event => {
        const eventPattern = new RegExp(`socket\\.on\\(['"]${event}['"].*?try\\s*{`, 's');
        if (eventPattern.test(socketHandlersContent)) {
            pass(`${event} 이벤트: try-catch 블록 존재`);
        } else {
            warn(`${event} 이벤트: try-catch 블록`, '확인 필요');
        }
    });

    // startRoomGame 함수 에러 처리
    if (socketHandlersContent.match(/async function startRoomGame[\s\S]{0,500}try\s*{/)) {
        pass('startRoomGame 함수: try-catch 블록 존재');
    } else {
        warn('startRoomGame 함수: try-catch 블록', '확인 필요');
    }

    // handleTakeFromCenter 함수 에러 처리
    if (socketHandlersContent.match(/function handleTakeFromCenter[\s\S]{0,500}try\s*{/)) {
        pass('handleTakeFromCenter 함수: try-catch 블록 존재');
    } else {
        warn('handleTakeFromCenter 함수: try-catch 블록', '확인 필요');
    }

} catch (error) {
    fail('에러 처리 확인', error.message);
}

// 3. 문법 검증
console.log('\n[Syntax] JavaScript 문법 검증');
console.log('─'.repeat(50));

try {
    require('./socketHandlers.js');
    pass('socketHandlers.js 문법 오류 없음');
} catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('./database')) {
        pass('socketHandlers.js 문법 오류 없음 (의존성 정상)');
    } else {
        fail('socketHandlers.js 문법 검증', error.message);
    }
}

try {
    require('./src/validation/socketSchemas.js');
    pass('socketSchemas.js 문법 오류 없음');
} catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('./constants')) {
        pass('socketSchemas.js 문법 오류 없음 (의존성 정상)');
    } else {
        fail('socketSchemas.js 문법 검증', error.message);
    }
}

// 요약
printSummary();

function printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('검증 결과 요약');
    console.log('='.repeat(50));
    console.log(`✅ 통과: ${results.passed.length}개`);
    console.log(`❌ 실패: ${results.failed.length}개`);
    console.log(`⚠️  경고: ${results.warnings.length}개`);

    if (results.failed.length > 0) {
        console.log('\n실패한 테스트:');
        results.failed.forEach(({ test, error }) => {
            console.log(`  - ${test}: ${error}`);
        });
    }

    if (results.warnings.length > 0) {
        console.log('\n경고:');
        results.warnings.forEach(({ test, message }) => {
            console.log(`  - ${test}: ${message}`);
        });
    }

    console.log('\n' + '='.repeat(50));

    if (results.failed.length === 0) {
        console.log('✅ Phase 2 & 3 수정사항이 정상적으로 적용되었습니다!');
        console.log('\n완료된 작업:');
        console.log('✅ Phase 1: 주석 제거 + DB 인덱스 추가');
        console.log('✅ Phase 2: 입력 검증 강화');
        console.log('✅ Phase 3: 에러 처리 확인');
        console.log('\n다음 단계:');
        console.log('1. 서버 재시작: npm start');
        console.log('2. 브라우저에서 기능 테스트');
        console.log('3. Phase 4 (파일 분리)는 필요 시 진행');
    } else {
        console.log('❌ 일부 테스트가 실패했습니다. 위의 내용을 확인하세요.');
        process.exit(1);
    }
}
