const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'sogang.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
    console.log('데이터베이스에 성공적으로 연결되었습니다.');
});

const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
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

            db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('accessCode', '1234')", (err) => {
                if (err) return reject(err);
                console.log('데이터베이스 테이블이 성공적으로 준비되었습니다.');
                resolve();
            });
        });
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
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

module.exports = {
    initializeDatabase,
    getUser: (username) => get('SELECT * FROM users WHERE username = ?', [username]),
    getAllUsers: () => query('SELECT id, username, score FROM users'),
    createUser: (username, hashedPassword) => run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]),
    updateUserScore: (username, newScore) => run('UPDATE users SET score = ? WHERE username = ?', [newScore, username]),
    getAccessCode: async () => {
        const row = await get("SELECT value FROM settings WHERE key = 'accessCode'");
        return row ? row.value : null;
    },
    setAccessCode: (newCode) => run("INSERT OR REPLACE INTO settings (key, value) VALUES ('accessCode', ?)", [newCode]),
}; 