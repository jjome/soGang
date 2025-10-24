// The Gang 특수 카드 시스템 (공식 매뉴얼 기준)

// 챌린지 카드 (게임을 어렵게 만듦)
const CHALLENGE_CARDS = {
    QUICK_ACCESS: {
        id: 'quick_access',
        name: 'Quick Access',
        description: '라운드 1 건너뛰기 - 화이트 칩 없이 바로 라운드 2로',
        effect: (room) => {
            room.skipRound1 = true;
        }
    },
    NOISE_SENSORS: {
        id: 'noise_sensors',
        name: 'Noise Sensors',
        description: '라운드 1, 2, 3의 1-별 칩을 다크사이드로 (소유권 변경 불가)',
        effect: (room) => {
            room.darkSideChips = { round1: 1, round2: 1, round3: 1 };
        }
    },
    MOTION_DETECTOR: {
        id: 'motion_detector',
        name: 'Motion Detector',
        description: '라운드 2에서 J/Q/K가 있으면 화이트 1-별 소유자 카드 교체',
        effect: (room) => {
            room.motionDetectorActive = true;
        }
    },
    RETINA_SCAN: {
        id: 'retina_scan',
        name: 'Retina Scan',
        description: '쇼다운 전 최고 칩 소유자의 포켓 카드 값(2~A) 맞추기',
        effect: (room) => {
            room.retinaScanActive = true;
        }
    },
    HASTY_GETAWAY: {
        id: 'hasty_getaway',
        name: 'Hasty Getaway',
        description: '라운드 3 건너뛰기 - 오렌지 칩 없이 바로 라운드 4로',
        effect: (room) => {
            room.skipRound3 = true;
        }
    },
    VENTILATION_SHAFT: {
        id: 'ventilation_shaft',
        name: 'Ventilation Shaft',
        description: '라운드 1, 2, 3의 최고-별 칩을 다크사이드로 (소유권 변경 불가)',
        effect: (room) => {
            const maxStars = room.players.size;
            room.darkSideChips = { round1: maxStars, round2: maxStars, round3: maxStars };
        }
    },
    LASER_TRIPWIRES: {
        id: 'laser_tripwires',
        name: 'Laser Tripwires',
        description: '라운드 2에서 J/Q/K가 없으면 최고 화이트 칩 소유자 카드 교체',
        effect: (room) => {
            room.laserTripwiresActive = true;
        }
    },
    BLACKOUT: {
        id: 'blackout',
        name: 'Blackout',
        description: '각 라운드 시작 시 이전 라운드 칩 모두 버림',
        effect: (room) => {
            room.blackoutActive = true;
        }
    },
    FINGERPRINT_SCAN: {
        id: 'fingerprint_scan',
        name: 'Fingerprint Scan',
        description: '쇼다운 전 최고 칩 소유자의 핸드 랭킹 맞추기',
        effect: (room) => {
            room.fingerprintScanActive = true;
        }
    },
    SECURITY_CAMERAS: {
        id: 'security_cameras',
        name: 'Security Cameras',
        description: '모든 플레이어 포켓 카드 3장으로 플레이 (8장 중 5장 조합)',
        effect: (room) => {
            room.pocketCardsCount = 3;
        }
    }
};

// 스페셜리스트 카드 (게임을 쉽게 만듦)
const SPECIALIST_CARDS = {
    INFORMANT: {
        id: 'informant',
        name: 'Informant',
        description: '한 플레이어가 다른 플레이어에게 포켓 카드 1장 비밀리에 보여줌',
        effect: (room) => {
            room.informantAvailable = true;
        }
    },
    GETAWAY_DRIVER: {
        id: 'getaway_driver',
        name: 'Getaway Driver',
        description: '한 플레이어가 현재 핸드 랭킹 공개 (구체적 카드는 비공개)',
        effect: (room) => {
            room.getawayDriverAvailable = true;
        }
    },
    INVESTOR: {
        id: 'investor',
        name: 'Investor',
        description: '라운드 1 시작 시 모든 플레이어가 페이스 카드(J, Q, K) 개수 공개',
        effect: (room) => {
            room.investorActive = true;
        }
    },
    MASTERMIND: {
        id: 'mastermind',
        name: 'Mastermind',
        description: '그룹이 선택한 카드 값의 개수를 한 플레이어가 공개',
        effect: (room) => {
            room.mastermindAvailable = true;
        }
    },
    HACKER: {
        id: 'hacker',
        name: 'Hacker',
        description: '한 플레이어가 덱에서 카드 1장 추가로 뽑고 1장 버림',
        effect: (room) => {
            room.hackerAvailable = true;
        }
    },
    COORDINATOR: {
        id: 'coordinator',
        name: 'Coordinator',
        description: '라운드 1 시작 시 모든 플레이어가 포켓 카드 1장을 왼쪽으로 넘김',
        effect: (room) => {
            room.coordinatorActive = true;
        }
    },
    JACK: {
        id: 'jack',
        name: 'Jack',
        description: '한 플레이어가 Jack 카드를 포켓에 추가하고 카드 1장 버림 (J, 무늬 없음)',
        effect: (room) => {
            room.jackCardAvailable = true;
        }
    },
    MATH_WHIZ: {
        id: 'math_whiz',
        name: 'Math Whiz',
        description: '라운드 1 시작 시 모든 플레이어가 포켓 카드 합계 공개 (J/Q/K=10, A=11)',
        effect: (room) => {
            room.mathWhizActive = true;
        }
    },
    CON_ARTIST: {
        id: 'con_artist',
        name: 'Con Artist',
        description: '라운드 1 시작 후 모든 포켓 카드를 섞어 재분배 (자신이 본 2장 기억 가능)',
        effect: (room) => {
            room.conArtistActive = true;
        }
    },
    MUSCLE: {
        id: 'muscle',
        name: 'Muscle',
        description: '한 플레이어가 쇼다운에서 같은 랭킹의 다른 핸드를 모두 이김',
        effect: (room) => {
            room.muscleAvailable = true;
        }
    }
};

// 게임 모드별 설정
const GAME_MODES = {
    BASIC: {
        name: 'Basic',
        description: '기본 게임 (특수 카드 없음)',
        challenges: 0,
        specialists: 0,
        maxAlarms: 3,
        requiredVaults: 3
    },
    ADVANCED: {
        name: 'Advanced',
        description: '성공 시 챌린지 1개, 실패 시 스페셜리스트 1개',
        challenges: 'dynamic', // 동적 활성화
        specialists: 'dynamic', // 동적 활성화
        maxAlarms: 3,
        requiredVaults: 3
    },
    PROFESSIONAL: {
        name: 'Professional',
        description: '게임 시작 시 챌린지 1개 영구 활성 + Advanced 규칙',
        permanentChallenges: 1, // Quick Access 제외
        challenges: 'dynamic',
        specialists: 'dynamic',
        maxAlarms: 3,
        requiredVaults: 3,
        excludeCards: ['quick_access']
    },
    MASTER_THIEF: {
        name: 'Master Thief',
        description: '챌린지 2개 항상 활성, 경보 2개로 패배, 스페셜리스트 없음',
        permanentChallenges: 2,
        specialists: 0,
        maxAlarms: 2,
        requiredVaults: 3,
        excludeCards: ['quick_access']
    }
};

// 랜덤 카드 선택 함수
function selectRandomCards(cardPool, count) {
    const keys = Object.keys(cardPool);
    const selected = [];
    const shuffled = keys.sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        selected.push(cardPool[shuffled[i]]);
    }

    return selected;
}

// 게임 모드 초기화
function initializeGameMode(room, modeName = 'BASIC') {
    const mode = GAME_MODES[modeName] || GAME_MODES.BASIC;

    room.gameMode = mode.name;
    room.maxAlarms = mode.maxAlarms;
    room.requiredVaults = mode.requiredVaults;
    room.currentAlarms = 0;
    room.currentVaults = 0;

    // Advanced Mode 이상: 동적 카드 활성화
    if (mode.challenges === 'dynamic') {
        room.challengeStack = orderCards(CHALLENGE_CARDS, mode.excludeCards);
        room.specialistStack = orderCards(SPECIALIST_CARDS, []);
        room.currentChallengeCard = null;
        room.currentSpecialistCard = null;
    }

    // Professional/Master Thief Mode: 영구 챌린지 카드
    if (mode.permanentChallenges > 0) {
        const available = Object.values(CHALLENGE_CARDS).filter(
            card => !mode.excludeCards.includes(card.id)
        );
        room.permanentChallenges = selectRandomCards(
            Object.fromEntries(available.map(c => [c.id, c])),
            mode.permanentChallenges
        );
        room.permanentChallenges.forEach(card => card.effect(room));
    }

    console.log(`[Game Mode] ${mode.name} 모드 초기화 완료`);
}

// 카드 순서대로 정렬 (처음 플레이 시 1~10 순서)
function orderCards(cardPool, excludeIds = []) {
    const ordered = Object.values(cardPool)
        .filter(card => !excludeIds.includes(card.id))
        .sort((a, b) => {
            // 카드 번호 추출 (예: quick_access는 1번)
            const cardOrder = {
                'quick_access': 1, 'noise_sensors': 2, 'motion_detector': 3,
                'retina_scan': 4, 'hasty_getaway': 5, 'ventilation_shaft': 6,
                'laser_tripwires': 7, 'blackout': 8, 'fingerprint_scan': 9,
                'security_cameras': 10,
                'informant': 1, 'getaway_driver': 2, 'investor': 3,
                'mastermind': 4, 'hacker': 5, 'coordinator': 6,
                'jack': 7, 'math_whiz': 8, 'con_artist': 9, 'muscle': 10
            };
            return cardOrder[a.id] - cardOrder[b.id];
        });
    return ordered;
}

// 하이스트 결과 처리 (Advanced Mode)
function processHeistResult(room, success) {
    if (room.gameMode === 'BASIC') {
        // 기본 모드는 카드 없음
        if (success) {
            room.currentVaults = (room.currentVaults || 0) + 1;
        } else {
            room.currentAlarms = (room.currentAlarms || 0) + 1;
        }
        return checkGameEnd(room);
    }

    // Advanced/Professional/Master Thief Mode
    if (success) {
        room.currentVaults = (room.currentVaults || 0) + 1;

        // 성공 시 챌린지 카드 활성화
        if (room.challengeStack && room.challengeStack.length > 0) {
            room.currentChallengeCard = room.challengeStack.shift();
            room.currentChallengeCard.effect(room);
            console.log(`[Challenge] ${room.currentChallengeCard.name} 활성화`);
        }

        // 이전 스페셜리스트 카드 제거
        if (room.currentSpecialistCard) {
            room.currentSpecialistCard = null;
        }
    } else {
        room.currentAlarms = (room.currentAlarms || 0) + 1;

        // 실패 시 스페셜리스트 카드 활성화 (Master Thief 제외)
        if (room.gameMode !== 'Master Thief' && room.specialistStack && room.specialistStack.length > 0) {
            room.currentSpecialistCard = room.specialistStack.shift();
            room.currentSpecialistCard.effect(room);
            console.log(`[Specialist] ${room.currentSpecialistCard.name} 활성화`);
        }

        // 이전 챌린지 카드 제거
        if (room.currentChallengeCard) {
            room.currentChallengeCard = null;
        }
    }

    return checkGameEnd(room);
}

// 게임 종료 조건 확인
function checkGameEnd(room) {
    if (room.currentVaults >= room.requiredVaults) {
        return {
            gameOver: true,
            victory: true,
            message: `승리! ${room.currentVaults}개의 금고를 모두 털었습니다!`
        };
    }

    if (room.currentAlarms >= room.maxAlarms) {
        return {
            gameOver: true,
            victory: false,
            message: `패배! ${room.currentAlarms}개의 경보가 울렸습니다!`
        };
    }

    return {
        gameOver: false,
        message: `금고: ${room.currentVaults}/${room.requiredVaults}, 경보: ${room.currentAlarms}/${room.maxAlarms}`
    };
}

// 스페셜리스트 카드 사용
function useSpecialistCard(room, cardId, playerId, targetId = null, data = null) {
    if (!room.currentSpecialistCard || room.currentSpecialistCard.id !== cardId) {
        return { success: false, message: '사용할 수 없는 카드입니다.' };
    }

    const card = room.currentSpecialistCard;

    // 카드별 특수 로직 (여기서는 기본 플래그만 설정)
    // 실제 구현은 socketHandlers.js에서 처리

    return {
        success: true,
        message: `${card.name} 카드를 사용했습니다!`,
        card: card
    };
}

module.exports = {
    CHALLENGE_CARDS,
    SPECIALIST_CARDS,
    GAME_MODES,
    initializeGameMode,
    processHeistResult,
    useSpecialistCard,
    selectRandomCards,
    orderCards
};
