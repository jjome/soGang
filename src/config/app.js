const path = require('path');
const fs = require('fs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

// 환경변수 로드
require('dotenv').config();

// 프로덕션 환경에서 필수 환경변수 검증
function validateEnvVariables() {
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.SESSION_SECRET) {
            throw new Error('🔴 FATAL: SESSION_SECRET must be set in production environment!');
        }
        if (process.env.SESSION_SECRET === 'a-truly-secret-key-for-sogang-reborn' ||
            process.env.SESSION_SECRET === 'a-truly-secret-key-for-sogang-reborn-dev') {
            throw new Error('🔴 FATAL: Default SESSION_SECRET cannot be used in production!');
        }
    }
}

validateEnvVariables();

// 애플리케이션 설정
const config = {
    PORT: process.env.PORT || 3000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'a-truly-secret-key-for-sogang-reborn-dev',
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',') :
        ['http://localhost:3000', 'http://127.0.0.1:3000']
};

// 세션 저장소 디렉토리 생성
const sessionDir = path.join(__dirname, '../../sessions');
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

// 세션 설정
const sessionConfig = {
    store: new FileStore({
        path: sessionDir,
        ttl: 86400, // 24시간
        reapInterval: 3600, // 1시간마다 만료된 세션 정리
        secret: config.SESSION_SECRET
    }),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTPS 환경에서만 true로 설정
        maxAge: 1000 * 60 * 60 * 24 // 1일
    }
};

module.exports = {
    config,
    sessionConfig
}; 