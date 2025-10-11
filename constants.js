// 게임 상수 정의
const GAME_CONSTANTS = {
    // 타이머 지연 시간 (밀리초)
    ROUND_TRANSITION_DELAY: 500,        // 라운드 전환 지연
    NEW_HEIST_DELAY: 1000,              // 새 하이스트 시작 지연
    ROOM_DELETE_DELAY_GAME: 30000,      // 게임 종료 후 방 삭제 지연 (30초)
    ROOM_DELETE_DELAY_NORMAL: 10000,    // 일반 방 삭제 지연 (10초)
    NEXT_ROUND_DELAY: 500,              // 다음 라운드 준비 지연
    AUTO_START_DELAY: 500,              // 게임 자동 시작 지연
    LOCK_TIMEOUT: 500,                  // 칩 락 타임아웃 (0.5초)

    // 게임 플레이어 설정
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 6,
    DEFAULT_CHIPS: 1000,

    // 연결 관리 (ConnectionManager에서 사용)
    CONNECTION_TIMEOUT: 60000,          // 연결 타임아웃 (1분)
    HEARTBEAT_INTERVAL: 30000,          // 하트비트 간격 (30초)
    RECONNECT_GRACE_PERIOD: 120000,     // 재연결 유예 기간 (2분)

    // 메시지 제한
    MAX_MESSAGE_LENGTH: 200,

    // 리소스 제한
    MAX_ROOMS: 1000,                    // 최대 방 개수
    MAX_ONLINE_USERS: 10000,            // 최대 동시 접속자
};

// 게임 모드
const GAME_MODES = {
    BASIC: 'BASIC',
    ADVANCED: 'ADVANCED',
    DISADVANTAGE: 'DISADVANTAGE'
};

// 게임 페이즈
const GAME_PHASES = {
    WAITING: 'waiting',
    ROUND1: 'round1',
    ROUND2: 'round2',
    ROUND3: 'round3',
    ROUND4: 'round4',
    SHOWDOWN: 'showdown',
    COMPLETED: 'completed'
};

// 플레이어 상태
const PLAYER_STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    IN_GAME: 'in_game',
    IN_LOBBY: 'in_lobby'
};

module.exports = {
    GAME_CONSTANTS,
    GAME_MODES,
    GAME_PHASES,
    PLAYER_STATUS
};
