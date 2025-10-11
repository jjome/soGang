const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('=== Phase 1 검증 스크립트 ===\n');

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

// 1. 파일 존재 확인
console.log('\n[1] 파일 구조 검증');
console.log('─'.repeat(50));

const files = [
    'socketHandlers.js',
    'database.js',
    'src/validation/socketSchemas.js',
    'package.json'
];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        pass(`파일 존재: ${file}`);
    } else {
        fail(`파일 존재: ${file}`, '파일을 찾을 수 없습니다');
    }
});

// 2. socketHandlers.js 검증
console.log('\n[2] socketHandlers.js 수정 검증');
console.log('─'.repeat(50));

try {
    const socketHandlersContent = fs.readFileSync(path.join(__dirname, 'socketHandlers.js'), 'utf8');

    // 주석 제거 확인
    if (socketHandlersContent.includes('const { GameStatsManager }')) {
        fail('주석 제거', 'GameStatsManager import가 여전히 존재합니다');
    } else {
        pass('주석 제거: GameStatsManager import');
    }

    if (socketHandlersContent.includes('const statsManager = new GameStatsManager()')) {
        fail('주석 제거', 'statsManager 인스턴스가 여전히 존재합니다');
    } else {
        pass('주석 제거: statsManager 인스턴스');
    }

    // validators import 확인
    if (socketHandlersContent.includes("require('./src/validation/socketSchemas')")) {
        pass('validators import 추가됨');
    } else {
        fail('validators import', 'socketSchemas import가 없습니다');
    }

} catch (error) {
    fail('socketHandlers.js 읽기', error.message);
}

// 3. DB 인덱스 검증
console.log('\n[3] 데이터베이스 인덱스 검증');
console.log('─'.repeat(50));

const dbPath = path.join(__dirname, 'data', 'sogang.db');

if (!fs.existsSync(dbPath)) {
    warn('DB 인덱스 검증', 'DB 파일이 없습니다. 서버를 한 번 실행해주세요.');
} else {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            fail('DB 연결', err.message);
            return;
        }

        // 인덱스 확인
        const expectedIndexes = [
            'idx_games_status',
            'idx_game_players_username',
            'idx_player_actions_game_round'
        ];

        db.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'", [], (err, rows) => {
            if (err) {
                fail('인덱스 조회', err.message);
            } else {
                const existingIndexes = rows.map(row => row.name);

                expectedIndexes.forEach(indexName => {
                    if (existingIndexes.includes(indexName)) {
                        pass(`인덱스 존재: ${indexName}`);
                    } else {
                        fail(`인덱스 존재: ${indexName}`, '인덱스를 찾을 수 없습니다');
                    }
                });
            }

            db.close();
            printSummary();
        });
    });

    return; // 비동기 처리를 위해 여기서 종료
}

// 4. package.json 검증
console.log('\n[4] 패키지 의존성 검증');
console.log('─'.repeat(50));

try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

    if (packageJson.dependencies && packageJson.dependencies.joi) {
        pass(`joi 패키지 설치됨 (${packageJson.dependencies.joi})`);
    } else {
        fail('joi 패키지', 'package.json에 joi가 없습니다');
    }

} catch (error) {
    fail('package.json 읽기', error.message);
}

// 5. validation schema 검증
console.log('\n[5] Validation Schema 검증');
console.log('─'.repeat(50));

try {
    const schemaPath = path.join(__dirname, 'src/validation/socketSchemas.js');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    const requiredValidators = [
        'createRoom',
        'takeFromCenter',
        'takeFromPlayer',
        'exchangeWithCenter',
        'exchangeWithPlayer',
        'pass'
    ];

    requiredValidators.forEach(validator => {
        if (schemaContent.includes(validator + ':') || schemaContent.includes(validator + ' :')) {
            pass(`Validator 정의: ${validator}`);
        } else {
            warn(`Validator 정의: ${validator}`, '정의를 찾을 수 없습니다');
        }
    });

} catch (error) {
    fail('socketSchemas.js 읽기', error.message);
}

// DB가 없는 경우 여기서 요약 출력
if (!fs.existsSync(dbPath)) {
    printSummary();
}

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
        console.log('✅ Phase 1 수정사항이 정상적으로 적용되었습니다!');
        console.log('\n다음 단계:');
        console.log('1. npm start로 서버를 실행하세요');
        console.log('2. 브라우저에서 게임을 테스트하세요');
        console.log('3. 문제가 없으면 Phase 2를 진행하세요');
    } else {
        console.log('❌ 일부 테스트가 실패했습니다. 위의 내용을 확인하세요.');
        process.exit(1);
    }
}
