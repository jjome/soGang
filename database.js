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
                
                db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('accessCode', '002')", (err) => {
                    if (err) return reject(err);
                });

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
    getUser: (username) => get('SELECT * FROM users WHERE username = ?', [username]),
    getUserById: (id) => get('SELECT * FROM users WHERE id = ?', [id]),
    getAllUsers: () => query('SELECT id, username, score FROM users ORDER BY username'),
    createUser: (username, hashedPassword) => run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]),
    updateUserPassword: (userId, hashedPassword) => run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]),
    updateUserScore: (username, newScore) => run('UPDATE users SET score = ? WHERE username = ?', [newScore, username]),
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
}; 