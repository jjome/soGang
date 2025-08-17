const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 데이터 디렉토리 생성
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 파일 기반 데이터베이스 사용
const dbPath = path.join(dataDir, 'sogang.db');
const backupPath = path.join(dataDir, 'sogang_backup.db');

// 데이터베이스 백업 함수
const backupDatabase = () => {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dbPath)) {
            fs.copyFile(dbPath, backupPath, (err) => {
                if (err) {
                    console.error('데이터베이스 백업 실패:', err);
                    reject(err);
                } else {
                    console.log('데이터베이스 백업 완료');
                    resolve();
                }
            });
        } else {
            resolve(); // 백업할 파일이 없으면 그냥 성공
        }
    });
};

// 데이터베이스 복원 함수
const restoreDatabase = () => {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(backupPath) && !fs.existsSync(dbPath)) {
            fs.copyFile(backupPath, dbPath, (err) => {
                if (err) {
                    console.error('데이터베이스 복원 실패:', err);
                    reject(err);
                } else {
                    console.log('데이터베이스 복원 완료');
                    resolve();
                }
            });
        } else {
            resolve(); // 복원할 필요가 없으면 그냥 성공
        }
    });
};

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
    console.log(`데이터베이스에 성공적으로 연결되었습니다. (${dbPath})`);
});

const initializeDatabase = () => {
    return new Promise(async (resolve, reject) => {
        try {
            // 서버 시작 시 백업에서 복원 시도
            await restoreDatabase();
            
            db.serialize(() => {
                // 기존 테이블들
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        score INTEGER DEFAULT 0
                    )
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    )
                `, (err) => { if (err) return reject(err); });
                
                // 게임 관련 테이블들
                db.run(`
                    CREATE TABLE IF NOT EXISTS games (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        host_username TEXT NOT NULL,
                        max_players INTEGER DEFAULT 6,
                        status TEXT DEFAULT 'waiting',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        started_at DATETIME,
                        ended_at DATETIME,
                        FOREIGN KEY (host_username) REFERENCES users (username)
                    )
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS game_players (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        game_id INTEGER NOT NULL,
                        username TEXT NOT NULL,
                        seat_position INTEGER,
                        chips_at_start INTEGER DEFAULT 1000,
                        chips_at_end INTEGER,
                        final_rank INTEGER,
                        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (game_id) REFERENCES games (id),
                        FOREIGN KEY (username) REFERENCES users (username)
                    )
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS game_rounds (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        game_id INTEGER NOT NULL,
                        round_number INTEGER NOT NULL,
                        phase TEXT NOT NULL,
                        community_cards TEXT,
                        pot_amount INTEGER DEFAULT 0,
                        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        ended_at DATETIME,
                        FOREIGN KEY (game_id) REFERENCES games (id)
                    )
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS player_rounds (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        game_id INTEGER NOT NULL,
                        round_number INTEGER NOT NULL,
                        username TEXT NOT NULL,
                        chips_before INTEGER NOT NULL,
                        chips_after INTEGER NOT NULL,
                        cards TEXT,
                        bet_amount INTEGER DEFAULT 0,
                        fold BOOLEAN DEFAULT 0,
                        all_in BOOLEAN DEFAULT 0,
                        FOREIGN KEY (game_id) REFERENCES games (id),
                        FOREIGN KEY (username) REFERENCES users (username)
                    )
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS player_actions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        game_id INTEGER NOT NULL,
                        round_number INTEGER NOT NULL,
                        username TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        amount INTEGER DEFAULT 0,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        position TEXT,
                        FOREIGN KEY (game_id) REFERENCES games (id),
                        FOREIGN KEY (username) REFERENCES users (username)
                    )
                `, (err) => { if (err) return reject(err); });

                // 유저 통계 및 상태 테이블들
                db.run(`
                    CREATE TABLE IF NOT EXISTS user_stats (
                        username TEXT PRIMARY KEY,
                        total_games INTEGER DEFAULT 0,
                        total_wins INTEGER DEFAULT 0,
                        total_losses INTEGER DEFAULT 0,
                        total_chips_won INTEGER DEFAULT 0,
                        total_chips_lost INTEGER DEFAULT 0,
                        best_hand TEXT,
                        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (username) REFERENCES users (username)
                    )
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS user_adv_status (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        status_type INTEGER NOT NULL CHECK (status_type >= 1 AND status_type <= 10),
                        status_name TEXT NOT NULL,
                        level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 5),
                        points INTEGER DEFAULT 0,
                        description TEXT,
                        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (username) REFERENCES users (username),
                        UNIQUE(username, status_type)
                    )
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS user_dis_status (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        status_type INTEGER NOT NULL CHECK (status_type >= 1 AND status_type <= 10),
                        status_name TEXT NOT NULL,
                        level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 5),
                        points INTEGER DEFAULT 0,
                        description TEXT,
                        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (username) REFERENCES users (username),
                        UNIQUE(username, status_type)
                    )
                `, (err) => { if (err) return reject(err); });

                // 기본 설정값들
                db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('accessCode', '002')", (err) => {
                    if (err) return reject(err);
                });

                // 기본 장점/단점 상태 초기화
                db.run(`
                    INSERT OR IGNORE INTO user_adv_status (username, status_type, status_name, description)
                    SELECT username, 1, '공격적 플레이', '적극적인 베팅과 레이즈를 선호하는 플레이 스타일'
                    FROM users
                `, (err) => { if (err) return reject(err); });

                db.run(`
                    INSERT OR IGNORE INTO user_dis_status (username, status_type, status_name, description)
                    SELECT username, 1, '과도한 베팅', '상황을 고려하지 않고 과도하게 베팅하는 경향'
                    FROM users
                `, (err) => { if (err) return reject(err); });

                db.get("SELECT value FROM settings WHERE key = 'admin_password'", [], (err, row) => {
                    if (err) return reject(err);
                    if (!row) {
                        bcrypt.hash('happy', 10, (err, hash) => {
                            if (err) return reject(err);
                            db.run("INSERT INTO settings (key, value) VALUES ('admin_password', ?)", [hash], (err) => {
                                if (err) return reject(err);
                                console.log('데이터베이스 테이블 및 기본값이 성공적으로 준비되었습니다.');
                                resolve();
                            });
                        });
                    } else {
                        console.log('데이터베이스 테이블이 성공적으로 준비되었습니다.');
                        resolve();
                    }
                });
            });
        } catch (error) {
            reject(error);
        }
    });
};

const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.error('DB 실행 오류:', err, '\nSQL:', sql, '\nParams:', params);
                return reject(err);
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

module.exports = {
    initializeDatabase,
    backupDatabase,
    restoreDatabase,
    
    // 기존 사용자 관련 함수들
    getUser: (username) => get('SELECT * FROM users WHERE username = ?', [username]),
    getUserById: (id) => get('SELECT * FROM users WHERE id = ?', [id]),
    getAllUsers: () => query('SELECT id, username, score FROM users ORDER BY username'),
    createUser: (username, hashedPassword) => run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]),
    updateUserPassword: (userId, hashedPassword) => run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]),
    updateUserScore: (username, newScore) => run('UPDATE users SET score = ? WHERE username = ?', [newScore, username]),
    deleteUser: (userId) => run('DELETE FROM users WHERE id = ?', [userId]),
    
    // 설정 관련 함수들
    getAdminPassword: async () => {
        const row = await get("SELECT value FROM settings WHERE key = 'admin_password'");
        return row ? row.value : null;
    },
    setAdminPassword: (hashedPassword) => run("UPDATE settings SET value = ? WHERE key = 'admin_password'", [hashedPassword]),
    getAccessCode: async () => {
        const row = await get("SELECT value FROM settings WHERE key = 'accessCode'");
        return row ? row.value : null;
    },
    setAccessCode: (newCode) => run("UPDATE settings SET value = ? WHERE key = 'accessCode'", [newCode]),
    
    // 게임 관련 함수들
    createGame: (name, hostUsername, maxPlayers = 6) => 
        run('INSERT INTO games (name, host_username, max_players) VALUES (?, ?, ?)', [name, hostUsername, maxPlayers]),
    
    getGame: (gameId) => get('SELECT * FROM games WHERE id = ?', [gameId]),
    
    getActiveGames: () => query('SELECT * FROM games WHERE status IN ("waiting", "playing") ORDER BY created_at DESC'),
    
    updateGameStatus: (gameId, status, startedAt = null, endedAt = null) => {
        if (startedAt && endedAt) {
            return run('UPDATE games SET status = ?, started_at = ?, ended_at = ? WHERE id = ?', [status, startedAt, endedAt, gameId]);
        } else if (startedAt) {
            return run('UPDATE games SET status = ?, started_at = ? WHERE id = ?', [status, startedAt, gameId]);
        } else if (endedAt) {
            return run('UPDATE games SET status = ?, ended_at = ? WHERE id = ?', [status, endedAt, gameId]);
        } else {
            return run('UPDATE games SET status = ? WHERE id = ?', [status, gameId]);
        }
    },
    
    addPlayerToGame: (gameId, username, seatPosition, chipsAtStart = 1000) =>
        run('INSERT INTO game_players (game_id, username, seat_position, chips_at_start) VALUES (?, ?, ?, ?)', 
            [gameId, username, seatPosition, chipsAtStart]),
    
    getGamePlayers: (gameId) => query('SELECT * FROM game_players WHERE game_id = ? ORDER BY seat_position', [gameId]),
    
    updatePlayerChips: (gameId, username, chipsAfter, finalRank = null) => {
        if (finalRank !== null) {
            return run('UPDATE game_players SET chips_at_end = ?, final_rank = ? WHERE game_id = ? AND username = ?', 
                [chipsAfter, finalRank, gameId, username]);
        } else {
            return run('UPDATE game_players SET chips_at_end = ? WHERE game_id = ? AND username = ?', 
                [chipsAfter, gameId, username]);
        }
    },
    
    // 라운드 관련 함수들
    createGameRound: (gameId, roundNumber, phase, communityCards = null) =>
        run('INSERT INTO game_rounds (game_id, round_number, phase, community_cards) VALUES (?, ?, ?, ?)', 
            [gameId, roundNumber, phase, communityCards]),
    
    updateRoundPot: (gameId, roundNumber, potAmount) =>
        run('UPDATE game_rounds SET pot_amount = ? WHERE game_id = ? AND round_number = ?', [potAmount, gameId, roundNumber]),
    
    endRound: (gameId, roundNumber) =>
        run('UPDATE game_rounds SET ended_at = CURRENT_TIMESTAMP WHERE game_id = ? AND round_number = ?', [gameId, roundNumber]),
    
    // 플레이어 라운드 상태 관련 함수들
    createPlayerRound: (gameId, roundNumber, username, chipsBefore, cards = null) =>
        run('INSERT INTO player_rounds (game_id, round_number, username, chips_before, chips_after, cards) VALUES (?, ?, ?, ?, ?, ?)', 
            [gameId, roundNumber, username, chipsBefore, chipsBefore, cards]),
    
    updatePlayerRound: (gameId, roundNumber, username, chipsAfter, betAmount, fold = false, allIn = false) =>
        run('UPDATE player_rounds SET chips_after = ?, bet_amount = ?, fold = ?, all_in = ? WHERE game_id = ? AND round_number = ? AND username = ?', 
            [chipsAfter, betAmount, fold, allIn, gameId, roundNumber, username]),
    
    // 액션 기록 관련 함수들
    recordPlayerAction: (gameId, roundNumber, username, actionType, amount = 0, position = null) =>
        run('INSERT INTO player_actions (game_id, round_number, username, action_type, amount, position) VALUES (?, ?, ?, ?, ?, ?)', 
            [gameId, roundNumber, username, actionType, amount, position]),
    
    getPlayerActions: (gameId, roundNumber) => 
        query('SELECT * FROM player_actions WHERE game_id = ? AND round_number = ? ORDER BY timestamp', [gameId, roundNumber]),
    
    // 유저 통계 관련 함수들
    getUserStats: (username) => get('SELECT * FROM user_stats WHERE username = ?', [username]),
    
    updateUserStats: (username, stats) => {
        const { totalGames, totalWins, totalLosses, totalChipsWon, totalChipsLost, bestHand } = stats;
        return run(`
            INSERT OR REPLACE INTO user_stats 
            (username, total_games, total_wins, total_losses, total_chips_won, total_chips_lost, best_hand, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [username, totalGames, totalWins, totalLosses, totalChipsWon, totalChipsLost, bestHand]);
    },
    
    // 유저 상태 관련 함수들
    getUserAdvStatus: (username) => query('SELECT * FROM user_adv_status WHERE username = ? ORDER BY status_type', [username]),
    
    updateUserAdvStatus: (username, statusType, statusName, level, points, description) =>
        run(`
            INSERT OR REPLACE INTO user_adv_status 
            (username, status_type, status_name, level, points, description, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [username, statusType, statusName, level, points, description]),
    
    getUserDisStatus: (username) => query('SELECT * FROM user_dis_status WHERE username = ? ORDER BY status_type', [username]),
    
    updateUserDisStatus: (username, statusType, statusName, level, points, description) =>
        run(`
            INSERT OR REPLACE INTO user_dis_status 
            (username, status_type, status_name, level, points, description, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [username, statusType, statusName, level, points, description]),
    
    // 초기 유저 상태 설정
    initializeUserStatus: async (username) => {
        try {
            // 기본 장점 상태 10개 설정
            const advStatuses = [
                { type: 1, name: '공격적 플레이', desc: '적극적인 베팅과 레이즈를 선호하는 플레이 스타일' },
                { type: 2, name: '블러프 마스터', desc: '상황을 읽고 적절한 블러프를 구사하는 능력' },
                { type: 3, name: '포지션 활용', desc: '좋은 포지션에서의 플레이를 잘 활용하는 능력' },
                { type: 4, name: '팟 컨트롤', desc: '팟 사이즈를 적절하게 조절하는 능력' },
                { type: 5, name: '리드 플레이', desc: '첫 번째로 액션을 취할 때의 판단력' },
                { type: 6, name: '커뮤니티 카드 활용', desc: '보드 카드를 잘 활용하는 능력' },
                { type: 7, name: '상대방 읽기', desc: '상대방의 플레이 패턴을 파악하는 능력' },
                { type: 8, name: '리스크 관리', desc: '리스크를 적절히 관리하는 능력' },
                { type: 9, name: '패턴 인식', desc: '게임의 패턴을 빠르게 인식하는 능력' },
                { type: 10, name: '적응력', desc: '상황에 따라 플레이를 적응시키는 능력' }
            ];
            
            // 기본 단점 상태 10개 설정
            const disStatuses = [
                { type: 1, name: '과도한 베팅', desc: '상황을 고려하지 않고 과도하게 베팅하는 경향' },
                { type: 2, name: '감정적 플레이', desc: '감정에 휘둘려 비합리적인 결정을 하는 경향' },
                { type: 3, name: '포지션 무시', desc: '포지션의 중요성을 간과하는 경향' },
                { type: 4, name: '과도한 블러프', desc: '상황에 맞지 않는 블러프를 시도하는 경향' },
                { type: 5, name: '팟 오즈', desc: '팟 사이즈를 고려하지 않는 경향' },
                { type: 6, name: '패턴 고착', desc: '한 가지 플레이 패턴에만 고착하는 경향' },
                { type: 7, name: '상대방 무시', desc: '상대방의 플레이를 고려하지 않는 경향' },
                { type: 8, name: '리스크 과소평가', desc: '리스크를 과소평가하는 경향' },
                { type: 9, name: '인내심 부족', desc: '좋은 기회를 기다리지 못하는 경향' },
                { type: 10, name: '학습 부족', desc: '게임에서 배우지 못하는 경향' }
            ];
            
            // 장점 상태 초기화
            for (const status of advStatuses) {
                await run(`
                    INSERT OR IGNORE INTO user_adv_status 
                    (username, status_type, status_name, level, points, description)
                    VALUES (?, ?, ?, 1, 0, ?)
                `, [username, status.type, status.name, status.desc]);
            }
            
            // 단점 상태 초기화
            for (const status of disStatuses) {
                await run(`
                    INSERT OR IGNORE INTO user_dis_status 
                    (username, status_type, status_name, level, points, description)
                    VALUES (?, ?, ?, 1, 0, ?)
                `, [username, status.type, status.name, status.desc]);
            }
            
            // 기본 통계 초기화
            await run(`
                INSERT OR IGNORE INTO user_stats 
                (username, total_games, total_wins, total_losses, total_chips_won, total_chips_lost)
                VALUES (?, 0, 0, 0, 0, 0)
            `, [username]);
            
            return true;
        } catch (error) {
            console.error('유저 상태 초기화 실패:', error);
            return false;
        }
    }
}; 