const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

let db;

async function initializeDatabase() {
    try {
        const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'sogang.db');
        const dbDir = path.dirname(dbPath);

        // 데이터베이스 디렉토리가 없으면 생성
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log(`Database directory created at: ${dbDir}`);
        }

        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log('데이터베이스에 성공적으로 연결되었습니다.');

        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                score INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
        
        const accessCode = await getAccessCode();
        if (accessCode === null) {
            await setAccessCode('1234');
        }

        console.log('데이터베이스 테이블이 성공적으로 준비되었습니다.');
    } catch (error) {
        console.error('데이터베이스 초기화 실패:', error);
        process.exit(1);
    }
}

// --- User Functions ---
const getUser = (username) => db.get('SELECT * FROM users WHERE username = ?', username);
const getAllUsers = () => db.all('SELECT id, username, score FROM users');
const createUser = (username, hashedPassword) => db.run('INSERT INTO users (username, password) VALUES (?, ?)', username, hashedPassword);
const updateUserScore = (username, newScore) => db.run('UPDATE users SET score = ? WHERE username = ?', newScore, username);

// --- Settings Functions ---
async function getAccessCode() {
    const row = await db.get("SELECT value FROM settings WHERE key = 'accessCode'");
    return row ? row.value : null;
}

const setAccessCode = (newCode) => db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('accessCode', ?)", newCode);

module.exports = {
    initializeDatabase,
    getUser,
    getAllUsers,
    createUser,
    updateUserScore,
    getAccessCode,
    setAccessCode,
}; 