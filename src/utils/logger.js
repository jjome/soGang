// 간단한 로깅 유틸리티
// 환경변수로 로그 레벨 제어

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

// 환경변수에서 로그 레벨 가져오기 (기본값: debug)
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] !== undefined ?
    LOG_LEVELS[process.env.LOG_LEVEL] :
    LOG_LEVELS.debug;

class Logger {
    static error(...args) {
        if (currentLevel >= LOG_LEVELS.error) {
            console.error('[ERROR]', ...args);
        }
    }

    static warn(...args) {
        if (currentLevel >= LOG_LEVELS.warn) {
            console.warn('[WARN]', ...args);
        }
    }

    static info(...args) {
        if (currentLevel >= LOG_LEVELS.info) {
            console.log('[INFO]', ...args);
        }
    }

    static debug(...args) {
        if (currentLevel >= LOG_LEVELS.debug) {
            console.log('[DEBUG]', ...args);
        }
    }

    // 기존 console.log를 대체하기 위한 메서드
    static log(...args) {
        this.debug(...args);
    }
}

module.exports = Logger;
