// The Gang 특수 카드 시스템

// 챌린지 카드 (게임을 어렵게 만듦)
const CHALLENGE_CARDS = {
    QUICK_ACCESS: {
        id: 'quick_access',
        name: 'Quick Access',
        description: '각 라운드 시간 제한 30초',
        effect: (room) => {
            room.turnTimeLimit = 30000; // 30초
        }
    },
    NOISE_SENSORS: {
        id: 'noise_sensors',
        name: 'Noise Sensors',
        description: '말하기 금지, 칩으로만 소통',
        effect: (room) => {
            room.noTalking = true;
        }
    },
    MOTION_DETECTOR: {
        id: 'motion_detector',
        name: 'Motion Detector',
        description: '칩 교환 시 모든 플레이어에게 알림',
        effect: (room) => {
            room.motionDetector = true;
        }
    },
    RETINA_SCAN: {
        id: 'retina_scan',
        name: 'Retina Scan',
        description: '플레이어는 자신의 카드 1장만 볼 수 있음',
        effect: (room) => {
            room.limitedVision = true;
        }
    },
    PRESSURE_PLATES: {
        id: 'pressure_plates',
        name: 'Pressure Plates',
        description: '칩을 가져가면 다시 놓을 수 없음',
        effect: (room) => {
            room.noChipReturn = true;
        }
    },
    LASER_GRID: {
        id: 'laser_grid',
        name: 'Laser Grid',
        description: '라운드당 액션 횟수 제한 (3회)',
        effect: (room) => {
            room.actionLimit = 3;
        }
    },
    FINGERPRINT_LOCK: {
        id: 'fingerprint_lock',
        name: 'Fingerprint Lock',
        description: '같은 숫자 칩 2개 이상 금지',
        effect: (room) => {
            room.noDuplicateChips = true;
        }
    },
    THERMAL_IMAGING: {
        id: 'thermal_imaging',
        name: 'Thermal Imaging',
        description: '마지막 라운드에서 모든 카드 공개',
        effect: (room) => {
            room.revealLastRound = true;
        }
    },
    BACKUP_GENERATOR: {
        id: 'backup_generator',
        name: 'Backup Generator',
        description: '하이스트 실패 시 추가 경보 1개',
        effect: (room) => {
            room.extraAlarm = true;
        }
    },
    SILENT_ALARM: {
        id: 'silent_alarm',
        name: 'Silent Alarm',
        description: '잘못된 칩 순서 시 즉시 경보',
        effect: (room) => {
            room.instantAlarm = true;
        }
    }
};

// 스페셜리스트 카드 (게임을 쉽게 만듦)
const SPECIALIST_CARDS = {
    INFORMANT: {
        id: 'informant',
        name: 'Informant',
        description: '한 번 다른 플레이어의 카드를 볼 수 있음',
        effect: (room) => {
            room.peekAllowed = true;
        }
    },
    GETAWAY_DRIVER: {
        id: 'getaway_driver',
        name: 'Getaway Driver',
        description: '하이스트 실패 시 한 번 재시도',
        effect: (room) => {
            room.retryAllowed = true;
        }
    },
    HACKER: {
        id: 'hacker',
        name: 'Hacker',
        description: '한 라운드 챌린지 카드 효과 무시',
        effect: (room) => {
            room.challengeBypass = 1;
        }
    },
    COORDINATOR: {
        id: 'coordinator',
        name: 'Coordinator',
        description: '라운드당 한 번 칩 재배치 가능',
        effect: (room) => {
            room.chipRearrange = true;
        }
    },
    LOOKOUT: {
        id: 'lookout',
        name: 'Lookout',
        description: '다음 커뮤니티 카드 1장 미리보기',
        effect: (room) => {
            room.previewNext = true;
        }
    },
    SAFE_CRACKER: {
        id: 'safe_cracker',
        name: 'Safe Cracker',
        description: '칩 별 개수 +1 (최대 7개)',
        effect: (room) => {
            room.extraChipStar = true;
        }
    },
    DISTRACTION: {
        id: 'distraction',
        name: 'Distraction',
        description: '한 번 모든 플레이어 칩 섞기',
        effect: (room) => {
            room.shuffleChips = true;
        }
    },
    INSIDE_MAN: {
        id: 'inside_man',
        name: 'Inside Man',
        description: '게임 시작 시 추가 정보 제공',
        effect: (room) => {
            room.extraInfo = true;
        }
    },
    DEMOLITION: {
        id: 'demolition',
        name: 'Demolition Expert',
        description: '한 라운드 건너뛰기 가능',
        effect: (room) => {
            room.skipRound = true;
        }
    },
    NEGOTIATOR: {
        id: 'negotiator',
        name: 'Negotiator',
        description: '경보 1개를 금고 1개로 교환 가능',
        effect: (room) => {
            room.alarmTrade = true;
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
        description: '챌린지 1개, 스페셜리스트 1개',
        challenges: 1,
        specialists: 1,
        maxAlarms: 3,
        requiredVaults: 3
    },
    PROFESSIONAL: {
        name: 'Professional',
        description: '챌린지 2개, 스페셜리스트 1개',
        challenges: 2,
        specialists: 1,
        maxAlarms: 3,
        requiredVaults: 3
    },
    MASTER_THIEF: {
        name: 'Master Thief',
        description: '챌린지 2개, 경보 2개로 패배',
        challenges: 2,
        specialists: 0,
        maxAlarms: 2,
        requiredVaults: 3
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
    
    // 챌린지 카드 선택 및 적용
    if (mode.challenges > 0) {
        room.challengeCards = selectRandomCards(CHALLENGE_CARDS, mode.challenges);
        room.challengeCards.forEach(card => {
            card.effect(room);
        });
    } else {
        room.challengeCards = [];
    }
    
    // 스페셜리스트 카드 선택 (적용은 플레이어가 사용할 때)
    if (mode.specialists > 0) {
        room.specialistCards = selectRandomCards(SPECIALIST_CARDS, mode.specialists);
        room.availableSpecialists = [...room.specialistCards];
    } else {
        room.specialistCards = [];
        room.availableSpecialists = [];
    }
    
    console.log(`[Game Mode] ${mode.name} 모드 초기화 완료`);
    console.log(`[Challenges] ${room.challengeCards.map(c => c.name).join(', ') || '없음'}`);
    console.log(`[Specialists] ${room.specialistCards.map(c => c.name).join(', ') || '없음'}`);
}

// 스페셜리스트 카드 사용
function useSpecialistCard(room, cardId, playerId) {
    const card = room.availableSpecialists.find(c => c.id === cardId);
    if (!card) {
        return { success: false, message: '사용할 수 없는 카드입니다.' };
    }
    
    // 카드 효과 적용
    card.effect(room);
    
    // 사용한 카드 제거
    const index = room.availableSpecialists.indexOf(card);
    room.availableSpecialists.splice(index, 1);
    
    // 사용 기록
    if (!room.usedSpecialists) {
        room.usedSpecialists = [];
    }
    room.usedSpecialists.push({
        card: card,
        usedBy: playerId,
        usedAt: new Date()
    });
    
    return { success: true, message: `${card.name} 카드를 사용했습니다!` };
}

// 하이스트 결과 처리
function processHeistResult(room, success) {
    if (success) {
        room.currentVaults = (room.currentVaults || 0) + 1;
        
        // 승리 조건 확인
        if (room.currentVaults >= room.requiredVaults) {
            return {
                gameOver: true,
                victory: true,
                message: `승리! ${room.currentVaults}개의 금고를 모두 털었습니다!`
            };
        }
        
        return {
            gameOver: false,
            message: `하이스트 성공! (${room.currentVaults}/${room.requiredVaults} 금고)`
        };
    } else {
        // 실패 시 경보 추가
        let alarmsToAdd = 1;
        if (room.extraAlarm) {
            alarmsToAdd = 2; // Backup Generator 챌린지 카드 효과
        }
        
        room.currentAlarms = (room.currentAlarms || 0) + alarmsToAdd;
        
        // 패배 조건 확인
        if (room.currentAlarms >= room.maxAlarms) {
            return {
                gameOver: true,
                victory: false,
                message: `패배! ${room.currentAlarms}개의 경보가 울렸습니다!`
            };
        }
        
        // Getaway Driver 스페셜리스트 카드 확인
        if (room.retryAllowed && !room.retryUsed) {
            room.retryUsed = true;
            return {
                gameOver: false,
                retry: true,
                message: `하이스트 실패! 하지만 Getaway Driver로 재시도합니다! (경보: ${room.currentAlarms}/${room.maxAlarms})`
            };
        }
        
        return {
            gameOver: false,
            message: `하이스트 실패! (경보: ${room.currentAlarms}/${room.maxAlarms})`
        };
    }
}

// 다크 사이드 칩 시스템 (고급 규칙)
const DARK_SIDE_CHIPS = {
    BLACK: {
        color: 'black',
        stars: [1, 2, 3, 4, 5, 6],
        special: true,
        description: '다크 사이드 칩 - 특별한 능력을 가진 칩'
    }
};

// 칩 유효성 검증
function validateChipPlacement(room, playerId, chipStars) {
    const player = room.players.get(playerId);
    if (!player) return { valid: false, reason: '플레이어를 찾을 수 없습니다.' };
    
    // Fingerprint Lock 챌린지 카드 효과
    if (room.noDuplicateChips) {
        const chipCounts = {};
        player.chips.forEach(chip => {
            chipCounts[chip.stars] = (chipCounts[chip.stars] || 0) + 1;
        });
        
        if (chipCounts[chipStars] >= 1) {
            return { valid: false, reason: '같은 숫자의 칩을 2개 이상 가질 수 없습니다.' };
        }
    }
    
    // Pressure Plates 챌린지 카드 효과
    if (room.noChipReturn && player.hasPlacedChip) {
        return { valid: false, reason: '이미 칩을 놓았으므로 다시 놓을 수 없습니다.' };
    }
    
    return { valid: true };
}

module.exports = {
    CHALLENGE_CARDS,
    SPECIALIST_CARDS,
    GAME_MODES,
    DARK_SIDE_CHIPS,
    initializeGameMode,
    useSpecialistCard,
    processHeistResult,
    validateChipPlacement,
    selectRandomCards
};