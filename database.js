require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL 연결 풀 설정
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'sogang',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.toString() : '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // 최대 연결 수
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 연결 테스트
pool.on('connect', () => {
    console.log('PostgreSQL 데이터베이스에 성공적으로 연결되었습니다.');
});

pool.on('error', (err) => {
    console.error('PostgreSQL 연결 오류:', err);
});

// 데이터베이스 초기화
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // users 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                score INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // settings 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // games 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                host_username VARCHAR(255) NOT NULL,
                max_players INTEGER DEFAULT 6,
                status VARCHAR(50) DEFAULT 'waiting',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                FOREIGN KEY (host_username) REFERENCES users (username)
            )
        `);

        // game_players 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_players (
                id SERIAL PRIMARY KEY,
                game_id INTEGER NOT NULL,
                username VARCHAR(255) NOT NULL,
                seat_position INTEGER,
                chips_at_start INTEGER DEFAULT 1000,
                chips_at_end INTEGER,
                final_rank INTEGER,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games (id),
                FOREIGN KEY (username) REFERENCES users (username)
            )
        `);

        // game_rounds 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_rounds (
                id SERIAL PRIMARY KEY,
                game_id INTEGER NOT NULL,
                round_number INTEGER NOT NULL,
                phase VARCHAR(50) NOT NULL,
                community_cards TEXT,
                pot_amount INTEGER DEFAULT 0,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games (id)
            )
        `);

        // player_rounds 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS player_rounds (
                id SERIAL PRIMARY KEY,
                game_id INTEGER NOT NULL,
                round_number INTEGER NOT NULL,
                username VARCHAR(255) NOT NULL,
                chips_before INTEGER NOT NULL,
                chips_after INTEGER NOT NULL,
                cards TEXT,
                bet_amount INTEGER DEFAULT 0,
                fold BOOLEAN DEFAULT FALSE,
                all_in BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (game_id) REFERENCES games (id),
                FOREIGN KEY (username) REFERENCES users (username)
            )
        `);

        // 초기 설정값 확인 및 설정
        const adminPasswordCheck = await client.query(
            "SELECT value FROM settings WHERE key = 'admin_password'"
        );

        if (adminPasswordCheck.rows.length === 0) {
            // 관리자 비밀번호가 없으면 환경변수에서 읽어서 설정
            const initialAdminPassword = process.env.ADMIN_PASSWORD || 'changeme';
            const hashedPassword = await bcrypt.hash(initialAdminPassword, 10);
            await client.query(
                "INSERT INTO settings (key, value, updated_at) VALUES ('admin_password', $1, CURRENT_TIMESTAMP)",
                [hashedPassword]
            );
            console.log('[DB] 초기 관리자 비밀번호가 설정되었습니다.');
            if (!process.env.ADMIN_PASSWORD) {
                console.warn('[DB] ⚠️  경고: .env에 ADMIN_PASSWORD를 설정하세요! 현재 기본값 "changeme" 사용 중');
            }
        }

        await client.query('COMMIT');
        console.log('데이터베이스 테이블이 성공적으로 준비되었습니다.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('데이터베이스 초기화 실패:', err);
        throw err;
    } finally {
        client.release();
    }
};

// 사용자 등록
const registerUser = async (username, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        return { success: true, user: result.rows[0] };
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return { success: false, message: '이미 존재하는 사용자명입니다.' };
        }
        throw err;
    }
};

// 사용자 로그인
const loginUser = async (username, password) => {
    const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
    );

    if (result.rows.length === 0) {
        return { success: false, message: '존재하지 않는 사용자입니다.' };
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return { success: false, message: '비밀번호가 일치하지 않습니다.' };
    }

    return { success: true, user: { id: user.id, username: user.username } };
};

// 사용자 조회
const getUserByUsername = async (username) => {
    const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
    );
    return result.rows[0];
};

// getUser 별칭 (호환성)
const getUser = getUserByUsername;

// ID로 사용자 조회
const getUserById = async (id) => {
    const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0];
};

// 사용자 생성 (호환성 함수)
const createUser = async (username, hashedPassword) => {
    const result = await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
        [username, hashedPassword]
    );
    return result.rows[0];
};

// 사용자 비밀번호 업데이트
const updateUserPassword = async (userId, hashedPassword) => {
    await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, userId]
    );
};

// 사용자 삭제
const deleteUser = async (userId) => {
    await pool.query(
        'DELETE FROM users WHERE id = $1',
        [userId]
    );
};

// 모든 사용자 조회
const getAllUsers = async () => {
    const result = await pool.query('SELECT id, username, score FROM users ORDER BY score DESC');
    return result.rows;
};

// 점수 업데이트
const updateUserScore = async (username, score) => {
    await pool.query(
        'UPDATE users SET score = score + $1 WHERE username = $2',
        [score, username]
    );
};

// 설정 값 가져오기
const getSetting = async (key) => {
    const result = await pool.query(
        'SELECT value FROM settings WHERE key = $1',
        [key]
    );
    return result.rows[0]?.value;
};

// 설정 값 저장하기
const setSetting = async (key, value) => {
    await pool.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key)
         DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
    );
};

// Admin Password 관련 함수
const getAdminPassword = async () => {
    const result = await pool.query(
        "SELECT value FROM settings WHERE key = 'admin_password'"
    );
    return result.rows[0]?.value || null;
};

const setAdminPassword = async (hashedPassword) => {
    await setSetting('admin_password', hashedPassword);
};

// Access Code 관련 함수
const getAccessCode = async () => {
    const result = await pool.query(
        "SELECT value FROM settings WHERE key = 'accessCode'"
    );
    return result.rows[0]?.value || null;
};

const setAccessCode = async (newCode) => {
    await setSetting('accessCode', newCode);
};

// 사용자 상태 초기화 (간소화 버전 - 기본 테이블만)
const initializeUserStatus = async (username) => {
    // PostgreSQL에서는 user_adv_status와 user_dis_status 테이블이 없으므로
    // 이 함수는 아무것도 하지 않습니다
    // 필요시 나중에 해당 테이블을 추가할 수 있습니다
    console.log(`[DB] initializeUserStatus 호출됨 (${username}) - PostgreSQL에서는 스킵`);
    return Promise.resolve();
};

// 게임 생성
const createGame = async (name, hostUsername, maxPlayers = 6) => {
    const result = await pool.query(
        'INSERT INTO games (name, host_username, max_players) VALUES ($1, $2, $3) RETURNING *',
        [name, hostUsername, maxPlayers]
    );
    return result.rows[0];
};

// 게임 플레이어 추가
const addGamePlayer = async (gameId, username, seatPosition) => {
    const result = await pool.query(
        'INSERT INTO game_players (game_id, username, seat_position) VALUES ($1, $2, $3) RETURNING *',
        [gameId, username, seatPosition]
    );
    return result.rows[0];
};

// 게임 상태 업데이트
const updateGameStatus = async (gameId, status) => {
    await pool.query(
        'UPDATE games SET status = $1 WHERE id = $2',
        [status, gameId]
    );
};

// 게임 종료
const endGame = async (gameId) => {
    await pool.query(
        'UPDATE games SET status = $1, ended_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['ended', gameId]
    );
};

// 데이터베이스 종료 (우아한 종료)
const closeDatabase = async () => {
    await pool.end();
    console.log('데이터베이스 연결이 종료되었습니다.');
};

// 백업 함수 (PostgreSQL은 자동 백업 기능이 있으므로 간소화)
const backupDatabase = async () => {
    console.log('[DB Backup] PostgreSQL은 자동 백업 기능을 사용합니다.');
    // Render PostgreSQL은 자동으로 백업을 관리합니다.
    // 추가 백업이 필요한 경우 pg_dump를 사용할 수 있습니다.
    return Promise.resolve();
};

module.exports = {
    pool,
    initializeDatabase,
    registerUser,
    loginUser,
    getUserByUsername,
    getUser, // 호환성 별칭
    getUserById,
    createUser,
    updateUserPassword,
    deleteUser,
    getAllUsers,
    updateUserScore,
    getSetting,
    setSetting,
    getAdminPassword,
    setAdminPassword,
    getAccessCode,
    setAccessCode,
    initializeUserStatus,
    createGame,
    addGamePlayer,
    updateGameStatus,
    endGame,
    closeDatabase,
    backupDatabase
};
