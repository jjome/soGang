// 연결 관리 및 메모리 누수 방지 시스템
const EventEmitter = require('events');

class ConnectionManager extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map(); // socketId -> connection info
        this.heartbeats = new Map(); // socketId -> last heartbeat time
        this.reconnectTimeouts = new Map(); // socketId -> timeout id
        this.cleanupInterval = null;
        
        this.config = {
            heartbeatInterval: 30000, // 30초마다 heartbeat
            connectionTimeout: 60000, // 60초 후 타임아웃
            reconnectGrace: 120000, // 2분 재연결 유예시간
            maxReconnectAttempts: 3,
            cleanupInterval: 300000 // 5분마다 정리
        };

        this.startCleanupRoutine();
    }

    // 연결 등록
    registerConnection(socket, username) {
        const connectionInfo = {
            socketId: socket.id,
            username: username,
            connectedAt: new Date(),
            lastActivity: new Date(),
            reconnectCount: 0,
            isReconnection: false,
            clientInfo: {
                userAgent: socket.request.headers['user-agent'],
                ip: socket.request.connection.remoteAddress,
                origin: socket.request.headers.origin
            }
        };

        // 기존 연결이 있는 경우 재연결로 처리
        const existingConnection = this.findConnectionByUsername(username);
        if (existingConnection) {
            connectionInfo.isReconnection = true;
            connectionInfo.reconnectCount = existingConnection.reconnectCount + 1;
            connectionInfo.originalConnectedAt = existingConnection.connectedAt;
            
            // 기존 연결 정리
            this.cleanupConnection(existingConnection.socketId, 'reconnection');
        }

        this.connections.set(socket.id, connectionInfo);
        this.heartbeats.set(socket.id, new Date());

        console.log(`[Connection] 연결 등록: ${username} (${socket.id}) - 재연결: ${connectionInfo.isReconnection}`);
        
        // 연결 이벤트 발생
        this.emit('connectionRegistered', {
            socket: socket,
            username: username,
            isReconnection: connectionInfo.isReconnection
        });

        return connectionInfo;
    }

    // 연결 해제
    unregisterConnection(socketId, reason = 'disconnect') {
        const connection = this.connections.get(socketId);
        if (!connection) return null;

        console.log(`[Connection] 연결 해제: ${connection.username} (${socketId}) - 이유: ${reason}`);

        // 재연결 유예기간 설정 (게임 중인 경우)
        if (reason === 'disconnect' && this.isInGame(connection.username)) {
            this.setReconnectGrace(connection);
        } else {
            this.cleanupConnection(socketId, reason);
        }

        return connection;
    }

    // 재연결 유예기간 설정
    setReconnectGrace(connection) {
        const timeoutId = setTimeout(() => {
            console.log(`[Connection] 재연결 시간 만료: ${connection.username}`);
            this.cleanupConnection(connection.socketId, 'reconnect_timeout');
            this.emit('reconnectTimeout', connection);
        }, this.config.reconnectGrace);

        this.reconnectTimeouts.set(connection.socketId, timeoutId);
        
        // 연결 정보 업데이트
        connection.disconnectedAt = new Date();
        connection.awaitingReconnect = true;

        this.emit('connectionGraced', connection);
    }

    // 연결 정리
    cleanupConnection(socketId, reason) {
        const connection = this.connections.get(socketId);
        if (connection) {
            // 재연결 타이머 정리
            if (this.reconnectTimeouts.has(socketId)) {
                clearTimeout(this.reconnectTimeouts.get(socketId));
                this.reconnectTimeouts.delete(socketId);
            }

            this.connections.delete(socketId);
            this.heartbeats.delete(socketId);

            this.emit('connectionCleaned', { connection, reason });
        }
    }

    // 하트비트 업데이트
    updateHeartbeat(socketId) {
        if (this.connections.has(socketId)) {
            this.heartbeats.set(socketId, new Date());
            const connection = this.connections.get(socketId);
            connection.lastActivity = new Date();
        }
    }

    // 활성 연결 상태 업데이트
    updateActivity(socketId, activity) {
        if (this.connections.has(socketId)) {
            const connection = this.connections.get(socketId);
            connection.lastActivity = new Date();
            connection.lastActivityType = activity;
        }
    }

    // 사용자명으로 연결 찾기
    findConnectionByUsername(username) {
        for (const connection of this.connections.values()) {
            if (connection.username === username) {
                return connection;
            }
        }
        return null;
    }

    // 게임 중인지 확인
    isInGame(username) {
        // 실제 구현에서는 gameRooms를 확인
        return false; // 임시
    }

    // 비활성 연결 감지
    detectInactiveConnections() {
        const now = new Date();
        const inactiveConnections = [];

        for (const [socketId, lastHeartbeat] of this.heartbeats) {
            if (now - lastHeartbeat > this.config.connectionTimeout) {
                inactiveConnections.push(socketId);
            }
        }

        return inactiveConnections;
    }

    // 연결 통계
    getConnectionStats() {
        const now = new Date();
        const stats = {
            totalConnections: this.connections.size,
            activeConnections: 0,
            inactiveConnections: 0,
            awaitingReconnect: 0,
            averageConnectionTime: 0,
            reconnectionRate: 0
        };

        let totalConnectionTime = 0;
        let reconnectionCount = 0;

        for (const connection of this.connections.values()) {
            const isActive = (now - this.heartbeats.get(connection.socketId)) < this.config.connectionTimeout;
            
            if (isActive) {
                stats.activeConnections++;
            } else {
                stats.inactiveConnections++;
            }

            if (connection.awaitingReconnect) {
                stats.awaitingReconnect++;
            }

            if (connection.isReconnection) {
                reconnectionCount++;
            }

            const connectionTime = connection.disconnectedAt 
                ? connection.disconnectedAt - connection.connectedAt
                : now - connection.connectedAt;
            totalConnectionTime += connectionTime;
        }

        if (stats.totalConnections > 0) {
            stats.averageConnectionTime = totalConnectionTime / stats.totalConnections;
            stats.reconnectionRate = reconnectionCount / stats.totalConnections;
        }

        return stats;
    }

    // 정리 루틴 시작
    startCleanupRoutine() {
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupInterval);
    }

    // 정리 수행
    performCleanup() {
        const inactiveConnections = this.detectInactiveConnections();
        
        for (const socketId of inactiveConnections) {
            console.log(`[Connection Cleanup] 비활성 연결 정리: ${socketId}`);
            this.cleanupConnection(socketId, 'inactive');
        }

        // 메모리 사용량 체크
        this.checkMemoryUsage();
        
        // 통계 로깅
        const stats = this.getConnectionStats();
        console.log(`[Connection Stats] 활성: ${stats.activeConnections}, 비활성: ${stats.inactiveConnections}, 재연결 대기: ${stats.awaitingReconnect}`);
    }

    // 메모리 사용량 체크
    checkMemoryUsage() {
        const used = process.memoryUsage();
        const threshold = 200 * 1024 * 1024; // 200MB
        
        if (used.heapUsed > threshold) {
            console.warn(`[Memory Warning] 힙 메모리 사용량 높음: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);
            
            // 강제 가비지 컬렉션 (production에서는 주의)
            if (global.gc && process.env.NODE_ENV !== 'production') {
                global.gc();
            }
        }
    }

    // 특정 사용자의 모든 연결 정리
    cleanupUserConnections(username, reason = 'cleanup') {
        const connectionsToCleanup = [];
        
        for (const [socketId, connection] of this.connections) {
            if (connection.username === username) {
                connectionsToCleanup.push(socketId);
            }
        }

        connectionsToCleanup.forEach(socketId => {
            this.cleanupConnection(socketId, reason);
        });

        return connectionsToCleanup.length;
    }

    // 연결 상태 확인
    isConnected(socketId) {
        return this.connections.has(socketId);
    }

    // 사용자 온라인 상태 확인
    isUserOnline(username) {
        return this.findConnectionByUsername(username) !== null;
    }

    // 연결 정보 조회
    getConnectionInfo(socketId) {
        return this.connections.get(socketId);
    }

    // 모든 연결 정보 조회
    getAllConnections() {
        return Array.from(this.connections.values());
    }

    // 정리 루틴 중지
    stopCleanupRoutine() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    // 모든 연결 종료 (서버 종료 시)
    shutdown() {
        console.log('[Connection Manager] 종료 중...');
        
        this.stopCleanupRoutine();
        
        // 모든 재연결 타이머 정리
        for (const timeoutId of this.reconnectTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        
        // 모든 연결 정리
        for (const socketId of this.connections.keys()) {
            this.cleanupConnection(socketId, 'shutdown');
        }

        console.log('[Connection Manager] 종료 완료');
    }
}

module.exports = ConnectionManager;