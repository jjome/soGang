const { app, server } = require('./src/app');
const db = require('./database');
const { config } = require('./src/config/app');

// --- 서버 시작 ---
async function startServer() {
    try {
        await db.initializeDatabase();
        console.log('데이터베이스가 성공적으로 초기화되었습니다.');
        
        server.listen(config.PORT, () => {
            console.log(`서버가 http://localhost:${config.PORT} 에서 실행 중입니다.`);
            console.log(`환경: ${config.NODE_ENV}`);
        });
    } catch (error) {
        console.error('서버 시작 실패:', error);
        process.exit(1);
    }
}

// 서버 종료 시 데이터베이스 백업
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} 신호를 받았습니다. 서버를 안전하게 종료합니다...`);
    
    try {
        // 데이터베이스 백업
        await db.backupDatabase();
        console.log('데이터베이스 백업이 완료되었습니다.');
        
        // 서버 종료
        server.close(() => {
            console.log('서버가 안전하게 종료되었습니다.');
            process.exit(0);
        });
        
        // 10초 후 강제 종료
        setTimeout(() => {
            console.error('강제 종료를 수행합니다.');
            process.exit(1);
        }, 10000);
        
    } catch (error) {
        console.error('서버 종료 중 오류 발생:', error);
        process.exit(1);
    }
};

// 예상치 못한 에러 처리
process.on('uncaughtException', (error) => {
    console.error('예상치 못한 에러:', error);
    if (config.NODE_ENV === 'production') {
        gracefulShutdown('UNCAUGHT_EXCEPTION');
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('처리되지 않은 Promise 거부:', reason);
    if (config.NODE_ENV === 'production') {
        gracefulShutdown('UNHANDLED_REJECTION');
    } else {
        process.exit(1);
    }
});

// 종료 신호 처리
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer(); 