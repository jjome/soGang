const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const PokerHandEvaluator = require('./pokerHandEvaluator');
const { initializeGameMode, useSpecialistCard, processHeistResult, validateChipPlacement } = require('./gangCards');
const { GameStatsManager } = require('./gameStats');
const UserSystemManager = require('./userSystem');
const ChatSystemManager = require('./chatSystem');
const ReplaySystemManager = require('./replaySystem');

// 서버 전체에서 사용자 및 방 정보를 관리
const onlineUsers = new Map(); // username -> Set(socket.id)
const gameRooms = new Map(); // roomId -> { id, name, players, maxPlayers, host, state }
const userStatus = new Map(); // socket.id -> { username, status, location, connectTime }

// 간단한 처리를 위해 락 제거

// 실시간 데이터 저장을 위한 게임 상태 매핑
const gameStateMapping = new Map(); // roomId -> { gameId, currentRound, phase }

// io 인스턴스 저장용
let io;

// 시스템 매니저 인스턴스들
const statsManager = new GameStatsManager();
const userManager = new UserSystemManager();
const chatManager = new ChatSystemManager();
const replayManager = new ReplaySystemManager();

// The Gang 게임 로직 함수들
function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ 
                suit, 
                value, 
                rank: value, // rank와 value를 같게 설정
                id: `${suit}${value}` 
            });
        }
    }
    
    // 덱 셔플
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
}

function initializeRound1(roomId, room) {
    console.log(`[Round1] 1라운드 시작 - 방 ID: ${roomId}`);
    
    // room.deck 사용 (이미 게임 시작 시 생성됨)
    const deck = room.deck;
    const playerSocketIds = Array.from(room.players.keys());
    
    // 각 플레이어에게 카드 2장씩 배분
    let cardIndex = 0;
    playerSocketIds.forEach(socketId => {
        const player = room.players.get(socketId);
        player.cards = [deck[cardIndex++], deck[cardIndex++]];
        player.cardsReceived = true;
        player.passed = false;
    });
    
    // 게임 상태 업데이트
    room.phase = 'round1';
    room.currentRound = 1;
    room.currentPlayer = 0;
    room.passedPlayers.clear();
    
    // 라운드 시작 시 초기화 완료
    
    // 1라운드 중앙 칩 설정 (흰색 칩, 플레이어 수만큼)
    const playerCount = room.players.size;
    room.centerChips = [];
    for (let i = 1; i <= playerCount; i++) {
        room.centerChips.push({ id: `center1_${i}`, value: i, color: 'white', stars: i });
    }
    
    console.log(`[Round1] 중앙 칩 설정 완료:`, room.centerChips);
    
    // 플레이어 칩 초기화
    room.players.forEach(player => {
        if (!player.chips) {
            player.chips = [];
        }
        // 라운드별 칩 저장 객체 초기화
        if (!player.roundChips) {
            player.roundChips = {};
        }
        player.passed = false;
    });
    
    // 1라운드 설정 정보
    const roundConfig = getRoundConfiguration(1);
    room.communityCards = []; // 커뮤니티 카드 초기화
    
    // 모든 플레이어에게 라운드 시작 알림
    io.to(roomId).emit('round1Started', {
        round: room.currentRound,
        maxRounds: 4,
        roundConfig: roundConfig,
        centerChips: room.centerChips,
        communityCards: room.communityCards,
        message: `1라운드 (${roundConfig.name}) 시작: ${roundConfig.description}`,
        gameState: getGameState(room)
    });
    
    // 각 플레이어에게 개별적으로 카드 전송
    playerSocketIds.forEach(socketId => {
        const player = room.players.get(socketId);
        io.to(socketId).emit('cardsReceived', {
            cards: player.cards,
            message: '카드 2장을 받았습니다.'
        });
    });
    
    // 턴 기반 게임에서 실시간 게임으로 변경
}

// 턴 시스템 제거로 인해 사용하지 않음
function startPlayerTurn_DISABLED(roomId, room) {
    const playerSocketIds = Array.from(room.players.keys());
    const currentSocketId = playerSocketIds[room.currentPlayer];
    const currentPlayerData = room.players.get(currentSocketId);
    
    console.log(`[Turn] ${currentPlayerData.username}의 턴 시작`);
    
    // 현재 플레이어에게 턴 알림
    io.to(currentSocketId).emit('yourTurn', {
        message: '당신의 턴입니다.',
        availableActions: getAvailableActions(room, currentSocketId)
    });
    
    // 다른 플레이어들에게 턴 정보 알림
    room.players.forEach((player, socketId) => {
        if (socketId !== currentSocketId) {
            io.to(socketId).emit('playerTurn', {
                currentPlayer: currentPlayerData.username,
                message: `${currentPlayerData.username}의 턴입니다.`
            });
        }
    });
}

function getAvailableActions(room, socketId) {
    const player = room.players.get(socketId);
    const actions = [];
    
    // 패스는 칩을 가지고 있을 때만 가능
    if (player.chips.length > 0) {
        actions.push('pass');
    }
    
    // 플레이어가 칩을 가지고 있지 않은 경우: 가져오기 가능
    if (player.chips.length === 0) {
        // 가운데 칩이 있으면 가져올 수 있음
        if (room.centerChips.length > 0) {
            actions.push('takeFromCenter');
        }
        
        // 다른 플레이어의 칩이 있으면 가져올 수 있음
        room.players.forEach((otherPlayer, otherSocketId) => {
            if (otherSocketId !== socketId && otherPlayer.chips.length > 0) {
                actions.push('takeFromPlayer');
            }
        });
    } else {
        // 플레이어가 칩을 가지고 있는 경우: 교환 가능
        if (room.centerChips.length > 0) {
            actions.push('exchangeWithCenter');
        }
        
        // 다른 플레이어와 교환 가능
        room.players.forEach((otherPlayer, otherSocketId) => {
            if (otherSocketId !== socketId && otherPlayer.chips.length > 0) {
                actions.push('exchangeWithPlayer');
            }
        });
    }
    
    return actions;
}

function handlePlayerAction(roomId, room, socketId, action, targetId) {
    const player = room.players.get(socketId);
    console.log(`[Action] ${player.username}이(가) ${action} 액션 수행`);

    console.log('Processing action:', action, 'with targetId:', targetId);
    
    switch (action) {
        case 'pass':
            console.log('[ACTION] Handling pass');
            handlePass(roomId, room, socketId);
            break;
        case 'takeFromCenter':
            console.log('[ACTION] Handling takeFromCenter with chipId:', targetId);
            handleTakeFromCenter(roomId, room, socketId, targetId);
            break;
        case 'takeFromPlayer':
            handleTakeFromPlayer(roomId, room, socketId, targetId);
            break;
        case 'exchangeWithCenter':
            handleExchangeWithCenter(roomId, room, socketId, targetId);
            break;
        case 'exchangeWithPlayer':
            handleExchangeWithPlayer(roomId, room, socketId, targetId);
            break;
        default:
            io.to(socketId).emit('error', { message: '잘못된 액션입니다.' });
            return;
    }
}

function handlePass(roomId, room, socketId) {
    const player = room.players.get(socketId);
    player.passed = true;
    room.passedPlayers.add(socketId);

    console.log(`[Pass] ${player.username}이(가) 패스했습니다.`);

    // 모든 플레이어에게 패스 알림
    io.to(roomId).emit('playerPassed', {
        player: player.username,
        message: `${player.username}이(가) 패스했습니다.`
    });

    // 턴 진행 제거 - 실시간 게임으로 변경
}

function handleTakeFromCenter(roomId, room, socketId, chipId) {
    const player = room.players.get(socketId);
    
    console.log(`\n=== [CHIP TAKE START] ===`);
    console.log(`Player: ${player.username}, ChipID: ${chipId}`);
    console.log(`Current centerChips:`, room.centerChips?.map(c => c.id));
    console.log(`Player current chips:`, player.chips?.length || 0);

    // 1. 기본 유효성 검사
    if (!room.centerChips || room.centerChips.length === 0) {
        console.log(`[ERROR] No center chips available`);
        io.to(socketId).emit('error', { message: '가운데 칩이 없습니다.' });
        return;
    }

    if (player.chips && player.chips.length > 0) {
        console.log(`[ERROR] Player already has chips:`, player.chips.length);
        io.to(socketId).emit('error', { message: '이미 칩을 가지고 있어서 더 가져올 수 없습니다.' });
        return;
    }

    // 2. 칩 찾기
    const chipIndex = room.centerChips.findIndex(chip => chip.id === chipId);
    if (chipIndex === -1) {
        console.log(`[ERROR] Chip not found. Available:`, room.centerChips.map(c => c.id));
        io.to(socketId).emit('error', { message: '해당 칩을 찾을 수 없습니다.' });
        return;
    }

    // 3. 칩 이동 (원자적 연산)
    const chip = room.centerChips.splice(chipIndex, 1)[0];
    if (!player.chips) player.chips = [];
    player.chips.push(chip);

    console.log(`[SUCCESS] Chip moved successfully`);
    console.log(`Remaining centerChips:`, room.centerChips.map(c => c.id));
    console.log(`Player chips:`, player.chips.map(c => c.id));

    // 4. 패스 상태 해제
    resetPassStatusDueToChipChange(room, socketId);

    // 5. 모든 플레이어에게 즉시 알림
    const updateData = {
        player: player.username,
        chip: chip,
        from: 'center',
        message: `${player.username}이(가) 가운데에서 칩을 가져왔습니다.`,
        gameState: getGameState(room)
    };

    console.log(`[BROADCAST] Sending chipTaken event to room ${roomId}`);
    console.log(`Event centerChips:`, updateData.gameState.centerChips?.length);
    console.log(`Room players:`, Array.from(room.players.keys()));
    
    // 모든 방법으로 이벤트 전송
    console.log(`[BROADCAST] Sending to room: ${roomId}`);
    io.to(roomId).emit('chipTaken', updateData);
    io.emit('chipTaken', updateData); // 전체 서버에 전송
    
    // 추가로 각 플레이어에게 직접 전송
    room.players.forEach((player, socketId) => {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
            targetSocket.emit('chipTaken', updateData);
            targetSocket.emit('gameStateUpdate', updateData.gameState);
            console.log(`[DIRECT] Sent to ${player.username} (${socketId}) - connected: ${targetSocket.connected}`);
        } else {
            console.log(`[ERROR] Socket not found for ${player.username} (${socketId})`);
        }
    });
    
    // 추가 이벤트들
    io.to(roomId).emit('gameStateUpdate', updateData.gameState);
    io.to(roomId).emit('centerChipsUpdate', { centerChips: room.centerChips });
    
    console.log(`[BROADCAST] All events sent`);
    
    console.log(`=== [CHIP TAKE END] ===\n`);

    // 턴 진행 제거 - 실시간 게임으로 변경
}

function handleTakeFromPlayer(roomId, room, socketId, data) {
    const { targetPlayerId, chipId } = data;
    const player = room.players.get(socketId);
    const targetPlayer = room.players.get(targetPlayerId);

    if (!targetPlayer) {
        io.to(socketId).emit('error', { message: '대상 플레이어를 찾을 수 없습니다.' });
        return;
    }

    // 플레이어가 이미 칩을 가지고 있는지 확인
    if (player.chips && player.chips.length > 0) {
        io.to(socketId).emit('error', { message: '이미 칩을 가지고 있어서 더 가져올 수 없습니다.' });
        return;
    }

    // 대상 플레이어의 칩 중복 확인
    if (!targetPlayer.chips || targetPlayer.chips.length === 0) {
        io.to(socketId).emit('error', { message: '대상 플레이어가 가진 칩이 없습니다.' });
        return;
    }

    const chipIndex = targetPlayer.chips.findIndex(chip => chip.id === chipId);
    if (chipIndex === -1) {
        io.to(socketId).emit('error', { message: '해당 칩이 이미 가져가졌거나 존재하지 않습니다.' });
        console.log(`[Take Error] ${player.username}이(가) ${targetPlayer.username}에게서 이미 없는 칩 ${chipId}를 가져오려 했습니다.`);
        return;
    }

    // 칩을 즉시 이동하여 중복 방지
    const chip = targetPlayer.chips.splice(chipIndex, 1)[0];
    if (!player.chips) {
        player.chips = [];
    }
    player.chips.push(chip);

    console.log(`[Take] ${player.username}이(가) ${targetPlayer.username}에게서 칩 ${chip.id}를 가져왔습니다.`);
    console.log(`[Take] ${targetPlayer.username}의 남은 칩:`, targetPlayer.chips);

    // 양쪽 플레이어 모두 칩 정보 변경으로 인한 패스 해제
    resetPassStatusDueToChipChange(room, socketId);
    resetPassStatusDueToChipChange(room, targetPlayerId);

    // 모든 플레이어에게 액션 알림 및 칩 상태 즉시 업데이트
    io.to(roomId).emit('chipTaken', {
        player: player.username,
        targetPlayer: targetPlayer.username,
        chip: chip,
        from: 'player',
        message: `${player.username}이(가) ${targetPlayer.username}에게서 칩을 가져왔습니다.`,
        centerChips: room.centerChips, // 중앙 칩 정보도 함께 전송
        gameState: getGameState(room)
    });

    // 턴 진행 제거 - 실시간 게임으로 변경
}

function handleExchangeWithCenter(roomId, room, socketId, data) {
    const { myChipId, centerChipId } = data;
    const player = room.players.get(socketId);

    const myChipIndex = player.chips.findIndex(chip => chip.id === myChipId);
    const centerChipIndex = room.centerChips.findIndex(chip => chip.id === centerChipId);

    if (myChipIndex === -1 || centerChipIndex === -1) {
        io.to(socketId).emit('error', { message: '교환할 칩을 찾을 수 없습니다.' });
        return;
    }

    const myChip = player.chips.splice(myChipIndex, 1)[0];
    const centerChip = room.centerChips.splice(centerChipIndex, 1)[0];

    player.chips.push(centerChip);
    room.centerChips.push(myChip);

    console.log(`[Exchange] ${player.username}이(가) 가운데와 칩을 교환했습니다.`);
    console.log(`[Exchange] 교환 후 중앙 칩:`, room.centerChips);

    // 칩 정보 변경으로 인한 패스 해제
    resetPassStatusDueToChipChange(room, socketId);

    // 모든 플레이어에게 액션 알림 및 칩 상태 즉시 업데이트
    io.to(roomId).emit('chipsExchanged', {
        player: player.username,
        myChip: centerChip,
        exchangedChip: myChip,
        with: 'center',
        message: `${player.username}이(가) 가운데와 칩을 교환했습니다.`,
        centerChips: room.centerChips, // 업데이트된 중앙 칩 정보 추가
        gameState: getGameState(room)
    });

    // 턴 진행 제거 - 실시간 게임으로 변경
}

function handleExchangeWithPlayer(roomId, room, socketId, data) {
    const { targetPlayerId, myChipId, targetChipId } = data;
    const player = room.players.get(socketId);
    const targetPlayer = room.players.get(targetPlayerId);

    if (!targetPlayer) {
        io.to(socketId).emit('error', { message: '대상 플레이어를 찾을 수 없습니다.' });
        return;
    }

    const myChipIndex = player.chips.findIndex(chip => chip.id === myChipId);
    const targetChipIndex = targetPlayer.chips.findIndex(chip => chip.id === targetChipId);

    if (myChipIndex === -1 || targetChipIndex === -1) {
        io.to(socketId).emit('error', { message: '교환할 칩을 찾을 수 없습니다.' });
        return;
    }

    const myChip = player.chips.splice(myChipIndex, 1)[0];
    const targetChip = targetPlayer.chips.splice(targetChipIndex, 1)[0];

    player.chips.push(targetChip);
    targetPlayer.chips.push(myChip);

    console.log(`[Exchange] ${player.username}과 ${targetPlayer.username}이(가) 칩을 교환했습니다.`);

    // 양쪽 플레이어 모두 칩 정보 변경으로 인한 패스 해제
    resetPassStatusDueToChipChange(room, socketId);
    resetPassStatusDueToChipChange(room, targetPlayerId);

    // 모든 플레이어에게 액션 알림
    io.to(roomId).emit('chipsExchanged', {
        player: player.username,
        targetPlayer: targetPlayer.username,
        myChip: targetChip,
        targetChip: myChip,
        with: 'player',
        message: `${player.username}과 ${targetPlayer.username}이(가) 칩을 교환했습니다.`,
        gameState: getGameState(room)
    });

    // 턴 진행 제거 - 실시간 게임으로 변경
}

function resetPassStatusDueToChipChange(room, excludeSocketId) {
    // 모든 플레이어의 패스 상태 해제 (칩을 가져간 플레이어 포함)
    room.players.forEach((player, socketId) => {
        if (player.hasPassed) {
            player.hasPassed = false;
            console.log(`[Pass Reset] ${player.username}의 패스 상태가 해제되었습니다.`);
            
            // 해당 플레이어에게 패스 해제 알림 전송
            io.to(socketId).emit('passStatusReset', {
                message: '칩 정보가 변경되어 패스가 해제되었습니다.'
            });
        }
    });
    
    // 방의 passedPlayers 집합도 초기화
    if (room.passedPlayers) {
        room.passedPlayers.clear();
    }
}

// 라운드별 설정 정보
function getRoundConfiguration(round) {
    const configs = {
        1: { 
            name: 'Pre-Flop', 
            chipColor: 'white', 
            description: '포켓카드 2장 배분',
            maxRounds: 4 // The Gang은 4라운드
        },
        2: { 
            name: 'Flop', 
            chipColor: 'yellow', 
            description: '커뮤니티 카드 3장 공개'
        },
        3: { 
            name: 'Turn', 
            chipColor: 'orange', 
            description: '커뮤니티 카드 1장 추가'
        },
        4: { 
            name: 'River', 
            chipColor: 'red', 
            description: '커뮤니티 카드 1장 추가'
        }
    };
    return configs[round] || configs[1];
}

// 다음 라운드 준비 함수
function prepareNextRound(room, roomId) {
    room.currentRound = (room.currentRound || 1) + 1;
    const maxRounds = room.maxRounds || 4; // The Gang은 4라운드
    
    if (room.currentRound > maxRounds) {
        // 게임 종료
        room.phase = 'finished';
        
        // 최종 점수 계산
        const finalScores = Array.from(room.players.values()).map(player => ({
            username: player.username,
            chips: player.chips || [],
            score: (player.chips || []).reduce((sum, chip) => sum + (chip.stars || chip.value || 1), 0)
        }));
        
        const winner = finalScores.reduce((prev, current) => 
            (current.score > prev.score) ? current : prev
        );
        
        io.to(roomId).emit('gameEnded', {
            winner: winner.username,
            finalScores: finalScores,
            message: `게임이 종료되었습니다! 승자: ${winner.username}`
        });
        
        console.log(`[Game End] 게임 종료 - 승자: ${winner.username}`);
        
    } else {
        // 다음 라운드 시작
        room.phase = 'playing';
        
        // 모든 플레이어의 상태 초기화
        room.players.forEach(player => {
            player.hasPassed = false;
        });
        
        // 라운드별 칩 색상 및 커뮤니티 카드 설정
        const roundConfig = getRoundConfiguration(room.currentRound);
        
        // 새로운 중앙 칩 생성 (라운드별 색상, 플레이어 수만큼)
        const playerCount = room.players.size;
        room.centerChips = [];
        for (let i = 1; i <= playerCount; i++) {
            room.centerChips.push({ id: `center${room.currentRound}_${i}`, value: i, color: roundConfig.chipColor, stars: i });
        }
        
        // 커뮤니티 카드 설정
        if (!room.communityCards) room.communityCards = [];
        if (!room.deck) room.deck = createDeck();
        
        // 각 플레이어에게 포켓카드 2장 (1라운드에만)
        if (room.currentRound === 1) {
            room.players.forEach(player => {
                player.cards = [room.deck.pop(), room.deck.pop()];
            });
        }
        
        // 라운드별 커뮤니티 카드 공개
        if (room.currentRound === 2) { // Flop - 3장
            room.communityCards = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
        } else if (room.currentRound === 3) { // Turn - 1장 추가
            room.communityCards.push(room.deck.pop());
        } else if (room.currentRound === 4) { // River - 1장 추가
            room.communityCards.push(room.deck.pop());
        }
        
        io.to(roomId).emit('nextRoundStarted', {
            round: room.currentRound,
            maxRounds: maxRounds,
            roundConfig: roundConfig,
            centerChips: room.centerChips,
            communityCards: room.communityCards,
            message: `${room.currentRound}라운드 (${roundConfig.name}) 시작: ${roundConfig.description}`,
            gameState: getGameState(room)
        });
        
        console.log(`[Next Round] ${room.currentRound}라운드 시작`);
    }
}

// 턴 시스템 제거로 인해 사용하지 않음
function nextTurn_DISABLED(roomId, room) {
    const playerSocketIds = Array.from(room.players.keys());
    
    // 모든 플레이어가 패스했는지 확인
    if (room.passedPlayers.size === playerSocketIds.length) {
        // 현재 라운드에 따라 적절한 종료 함수 호출
        switch (room.currentRound) {
            case 1:
                endRound1(roomId, room);
                break;
            case 2:
                endRound2(roomId, room);
                break;
            case 3:
                endRound3(roomId, room);
                break;
            case 4:
                endRound4(roomId, room);
                break;
            default:
                console.error(`[NextTurn] Unknown round: ${room.currentRound}`);
        }
        return;
    }

    // 다음 플레이어로 턴 이동
    do {
        room.currentPlayer = (room.currentPlayer + 1) % playerSocketIds.length;
    } while (room.passedPlayers.has(playerSocketIds[room.currentPlayer]));

    // 다음 플레이어의 턴 시작
    startPlayerTurn(roomId, room);
}

function endRound1(roomId, room) {
    console.log(`[Round1 End] 1라운드 종료 - 방 ID: ${roomId}`);
    
    room.phase = 'round1_end';

    // 모든 플레이어에게 라운드 종료 알림
    io.to(roomId).emit('round1Ended', {
        message: '1라운드가 종료되었습니다!',
        finalState: getGameState(room)
    });
    
    // 2초 후 자동으로 2라운드 시작
    setTimeout(() => {
        initializeRound2(roomId, room);
    }, 2000);
}

// 2라운드: Flop (커뮤니티 카드 3장)
function initializeRound2(roomId, room) {
    console.log(`[Round2] 2라운드(Flop) 시작 - 방 ID: ${roomId}`);
    
    // Flop 카드 3장 공개
    const deck = room.deck || createDeck();
    room.communityCards = room.communityCards || [];
    
    // 이미 사용된 카드 제외
    const usedCards = new Set();
    room.players.forEach(player => {
        player.cards.forEach(card => usedCards.add(card.id));
    });
    room.communityCards.forEach(card => usedCards.add(card.id));
    
    // 사용 가능한 카드에서 3장 선택
    const availableCards = deck.filter(card => !usedCards.has(card.id));
    const flopCards = availableCards.slice(0, 3);
    room.communityCards.push(...flopCards);
    
    // 게임 상태 업데이트
    room.phase = 'round2';
    room.currentRound = 2;
    room.currentPlayer = 0;
    room.passedPlayers.clear();
    
    // 노란색 칩으로 교체 (플레이어 수만큼)
    const playerCount = room.players.size;
    room.centerChips = [];
    for (let i = 1; i <= playerCount; i++) {
        room.centerChips.push({ id: `center${i}`, value: i, color: 'yellow', stars: i });
    }
    
    // 플레이어 칩 초기화 및 이전 라운드 칩 저장
    room.players.forEach(player => {
        // 이전 라운드 칩을 라운드별로 저장
        if (!player.roundChips) player.roundChips = {};
        if (player.chips && player.chips.length > 0) {
            player.roundChips[1] = [...player.chips]; // 1라운드 칩 저장
        }
        player.chips = [];  // 현재 라운드 칩 초기화
        player.passed = false;
    });
    
    // 모든 플레이어에게 라운드 시작 알림
    io.to(roomId).emit('round2Started', {
        message: '2라운드(Flop)가 시작되었습니다!',
        communityCards: room.communityCards,
        gameState: getGameState(room)
    });
    
    // 턴 기반 게임에서 실시간 게임으로 변경
}

// 3라운드: Turn (커뮤니티 카드 1장 추가)
function initializeRound3(roomId, room) {
    console.log(`[Round3] 3라운드(Turn) 시작 - 방 ID: ${roomId}`);
    
    // Turn 카드 1장 추가
    const deck = room.deck || createDeck();
    
    // 이미 사용된 카드 제외
    const usedCards = new Set();
    room.players.forEach(player => {
        player.cards.forEach(card => usedCards.add(card.id));
    });
    room.communityCards.forEach(card => usedCards.add(card.id));
    
    // 사용 가능한 카드에서 1장 선택
    const availableCards = deck.filter(card => !usedCards.has(card.id));
    const turnCard = availableCards[0];
    room.communityCards.push(turnCard);
    
    // 게임 상태 업데이트
    room.phase = 'round3';
    room.currentRound = 3;
    room.currentPlayer = 0;
    room.passedPlayers.clear();
    
    // 오렌지색 칩으로 교체 (플레이어 수만큼, 섞인 값)
    const playerCount = room.players.size;
    const values = [];
    for (let i = 1; i <= playerCount; i++) {
        values.push(i);
    }
    // 값을 섞기
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }
    room.centerChips = [];
    for (let i = 0; i < playerCount; i++) {
        room.centerChips.push({ id: `center${i + 1}`, value: values[i], color: 'orange', stars: values[i] });
    }
    
    // 플레이어 칩 초기화 및 이전 라운드 칩 저장
    room.players.forEach(player => {
        // 이전 라운드 칩을 라운드별로 저장
        if (!player.roundChips) player.roundChips = {};
        if (player.chips && player.chips.length > 0) {
            player.roundChips[2] = [...player.chips]; // 2라운드 칩 저장
        }
        player.chips = [];  // 현재 라운드 칩 초기화
        player.passed = false;
    });
    
    // 모든 플레이어에게 라운드 시작 알림
    io.to(roomId).emit('round3Started', {
        message: '3라운드(Turn)가 시작되었습니다!',
        communityCards: room.communityCards,
        gameState: getGameState(room)
    });
    
    // 턴 기반 게임에서 실시간 게임으로 변경
}

// 4라운드: River (커뮤니티 카드 1장 추가)
function initializeRound4(roomId, room) {
    console.log(`[Round4] 4라운드(River) 시작 - 방 ID: ${roomId}`);
    
    // River 카드 1장 추가
    const deck = room.deck || createDeck();
    
    // 이미 사용된 카드 제외
    const usedCards = new Set();
    room.players.forEach(player => {
        player.cards.forEach(card => usedCards.add(card.id));
    });
    room.communityCards.forEach(card => usedCards.add(card.id));
    
    // 사용 가능한 카드에서 1장 선택
    const availableCards = deck.filter(card => !usedCards.has(card.id));
    const riverCard = availableCards[0];
    room.communityCards.push(riverCard);
    
    // 게임 상태 업데이트
    room.phase = 'round4';
    room.currentRound = 4;
    room.currentPlayer = 0;
    room.passedPlayers.clear();
    
    // 빨간색 칩으로 교체 (플레이어 수만큼, 섞인 값)
    const playerCount = room.players.size;
    const values = [];
    for (let i = 1; i <= playerCount; i++) {
        values.push(i);
    }
    // 값을 섞기
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }
    room.centerChips = [];
    for (let i = 0; i < playerCount; i++) {
        room.centerChips.push({ id: `center${i + 1}`, value: values[i], color: 'red', stars: values[i] });
    }
    
    // 플레이어 칩 초기화 및 이전 라운드 칩 저장
    room.players.forEach(player => {
        // 이전 라운드 칩을 라운드별로 저장
        if (!player.roundChips) player.roundChips = {};
        if (player.chips && player.chips.length > 0) {
            player.roundChips[3] = [...player.chips]; // 3라운드 칩 저장
        }
        player.chips = [];  // 현재 라운드 칩 초기화
        player.passed = false;
    });
    
    // 모든 플레이어에게 라운드 시양 알림
    io.to(roomId).emit('round4Started', {
        message: '4라운드(River)가 시작되었습니다!',
        communityCards: room.communityCards,
        gameState: getGameState(room)
    });
    
    // 턴 기반 게임에서 실시간 게임으로 변경
}

// 라운드 종료 처리 수정
function endRound2(roomId, room) {
    console.log(`[Round2 End] 2라운드 종료 - 방 ID: ${roomId}`);
    
    room.phase = 'round2_end';

    // 모든 플레이어에게 라운드 종료 알림
    io.to(roomId).emit('round2Ended', {
        message: '2라운드가 종료되었습니다!',
        finalState: getGameState(room)
    });
    
    // 2초 후 자동으로 3라운드 시작
    setTimeout(() => {
        initializeRound3(roomId, room);
    }, 2000);
}

function endRound3(roomId, room) {
    console.log(`[Round3 End] 3라운드 종료 - 방 ID: ${roomId}`);
    
    room.phase = 'round3_end';

    // 모든 플레이어에게 라운드 종료 알림
    io.to(roomId).emit('round3Ended', {
        message: '3라운드가 종료되었습니다!',
        finalState: getGameState(room)
    });
    
    // 2초 후 자동으로 4라운드 시작
    setTimeout(() => {
        initializeRound4(roomId, room);
    }, 2000);
}

function endRound4(roomId, room) {
    console.log(`[Round4 End] 4라운드 종료 - 방 ID: ${roomId}`);
    
    room.phase = 'round4_end';

    // 모든 플레이어에게 라운드 종료 알림
    io.to(roomId).emit('round4Ended', {
        message: '4라운드가 종료되었습니다! 쇼다운을 시작합니다.',
        finalState: getGameState(room)
    });
    
    // 2초 후 쇼다운 시작
    setTimeout(() => {
        startShowdown(roomId, room);
    }, 2000);
}

// 쇼다운 로직
function startShowdown(roomId, room) {
    console.log(`[Showdown] 쇼다운 시작 - 방 ID: ${roomId}`);
    
    room.phase = 'showdown';
    
    // 플레이어들의 핸드 평가
    const playerHands = [];
    room.players.forEach((player, socketId) => {
        const evaluation = PokerHandEvaluator.evaluateHand(player.cards, room.communityCards);
        playerHands.push({
            playerId: socketId,
            username: player.username,
            hand: evaluation,
            chips: player.chips || []
        });
    });
    
    // 핸드 순위 매기기
    const rankings = PokerHandEvaluator.rankHands(playerHands);
    
    // 칩 순서 검증 (레드 칩 기준)
    const chipOrder = playerHands
        .filter(p => p.chips.length > 0 && p.chips[0].color === 'red')
        .sort((a, b) => (b.chips[0].stars || 0) - (a.chips[0].stars || 0));
    
    // 실제 핸드 강도 순서
    const actualOrder = rankings.sort((a, b) => a.rank - b.rank);
    
    // 순서가 맞는지 검증
    let isCorrectOrder = true;
    let violationDetails = [];
    
    for (let i = 0; i < Math.min(chipOrder.length - 1, actualOrder.length - 1); i++) {
        const chipPlayer = chipOrder[i];
        const actualPlayer = actualOrder[i];
        
        if (chipPlayer.username !== actualPlayer.username) {
            isCorrectOrder = false;
            violationDetails.push({
                expected: actualPlayer.username,
                actual: chipPlayer.username,
                position: i + 1
            });
        }
    }
    
    // 하이스트 성공/실패 판정
    const heistSuccess = isCorrectOrder;
    
    // 하이스트 결과 처리 (금고/경보 카운트)
    const heistResult = processHeistResult(room, heistSuccess);
    
    // 결과 저장
    room.showdownResult = {
        rankings,
        chipOrder,
        actualOrder,
        heistSuccess,
        violationDetails,
        heistResult
    };
    
    // 모든 플레이어에게 쇼다운 결과 전송
    io.to(roomId).emit('showdownResult', {
        message: heistResult.message,
        rankings: rankings.map(r => ({
            username: r.username,
            handName: r.hand.name,
            rank: r.rank,
            tied: r.tied,
            cards: r.hand.cards
        })),
        chipOrder: chipOrder.map(p => ({
            username: p.username,
            chipStars: p.chips[0]?.stars || 0
        })),
        heistSuccess,
        violationDetails,
        currentVaults: room.currentVaults,
        currentAlarms: room.currentAlarms,
        gameOver: heistResult.gameOver,
        victory: heistResult.victory
    });
    
    // 게임 종료 또는 다음 하이스트
    if (heistResult.gameOver) {
        setTimeout(() => {
            endGame(roomId, room, heistResult.victory);
        }, 5000);
    } else if (heistResult.retry) {
        // 재시도 (Getaway Driver 효과)
        setTimeout(() => {
            restartHeist(roomId, room);
        }, 3000);
    } else {
        // 다음 하이스트 준비
        setTimeout(() => {
            prepareNextHeist(roomId, room);
        }, 5000);
    }
}

// 다음 하이스트 준비
function prepareNextHeist(roomId, room) {
    console.log(`[Next Heist] 다음 하이스트 준비 - 방 ID: ${roomId}`);
    
    room.phase = 'preparing';
    
    // 플레이어 상태 초기화 (금고/경보 카운트는 유지)
    room.players.forEach(player => {
        player.cards = [];
        player.chips = [];
        player.passed = false;
    });
    
    // 게임 상태 초기화
    room.communityCards = [];
    room.centerChips = [];
    room.currentRound = 0;
    room.currentPlayer = 0;
    room.passedPlayers.clear();
    room.deck = createDeck(); // 새 덱 생성
    
    // 모든 플레이어에게 알림
    io.to(roomId).emit('nextHeistPreparing', {
        message: '다음 하이스트를 준비합니다...',
        currentVaults: room.currentVaults,
        currentAlarms: room.currentAlarms,
        challengeCards: room.challengeCards || [],
        availableSpecialists: room.availableSpecialists || []
    });
    
    // 3초 후 새 하이스트 시작
    setTimeout(() => {
        initializeRound1(roomId, room);
    }, 3000);
}

// 하이스트 재시도 (Getaway Driver 효과)
function restartHeist(roomId, room) {
    console.log(`[Restart Heist] 하이스트 재시도 - 방 ID: ${roomId}`);
    
    // 현재 하이스트 상태로 되돌리기
    prepareNextHeist(roomId, room);
}

// 게임 종료
function endGame(roomId, room, victory = false) {
    console.log(`[Game End] 게임 종료 - 방 ID: ${roomId}, 승리: ${victory}`);
    
    room.phase = 'ended';
    room.state = 'waiting';
    
    // 최종 통계 계산
    const finalStats = {
        victory: victory,
        vaults: room.currentVaults || 0,
        alarms: room.currentAlarms || 0,
        gameMode: room.gameMode || 'Basic',
        challengeCards: room.challengeCards || [],
        usedSpecialists: room.usedSpecialists || []
    };
    
    // 플레이어 상태 초기화
    room.players.forEach(player => {
        player.cards = [];
        player.chips = [];
        player.passed = false;
        player.ready = false;
    });
    
    // 게임 상태 완전 초기화
    room.communityCards = [];
    room.centerChips = [];
    room.currentRound = 0;
    room.currentPlayer = 0;
    room.passedPlayers.clear();
    
    // 게임 모드 관련 상태 초기화
    room.challengeCards = [];
    room.specialistCards = [];
    room.availableSpecialists = [];
    room.usedSpecialists = [];
    room.currentVaults = 0;
    room.currentAlarms = 0;
    
    // 모든 플레이어에게 게임 종료 알림
    io.to(roomId).emit('gameEnded', {
        message: victory ? '축하합니다! 모든 금고를 성공적으로 털었습니다!' : '아쉽습니다! 너무 많은 경보가 울렸습니다!',
        result: room.showdownResult,
        finalStats: finalStats
    });
}

function getGameState(room) {
    return {
        currentRound: room.currentRound,
        phase: room.phase,
        centerChips: room.centerChips,
        currentPlayer: room.currentPlayer,
        players: Array.from(room.players.entries()).map(([socketId, player]) => ({
            socketId,
            username: player.username,
            chipCount: player.chips ? player.chips.length : 0,
            chips: player.chips || [], // 현재 라운드 칩
            roundChips: player.roundChips || {}, // 라운드별 수집된 칩
            passed: player.passed,
            cards: player.cards
        }))
    };
}

// 관리자 권한 확인 함수
async function checkAdminStatus(socket) {
    return new Promise((resolve) => {
        try {
            // 세션에서 관리자 권한 확인
            const session = socket.request?.session;
            console.log('[checkAdminStatus] 세션 정보:', session);
            
            if (session && session.isAdmin) {
                console.log('[checkAdminStatus] 관리자 권한 확인됨');
                resolve(true);
            } else {
                console.log('[checkAdminStatus] 관리자 권한 없음 - session:', session);
                resolve(false);
            }
        } catch (error) {
            console.error('[checkAdminStatus] 오류 발생:', error);
            resolve(false);
        }
    });
}

// 실시간 데이터 저장 함수들
async function saveGameState(roomId, gameData) {
    try {
        const room = gameRooms.get(roomId);
        if (!room || !gameData.gameId) return;

        // 게임 상태 업데이트
        await db.updateGameStatus(gameData.gameId, gameData.status, gameData.startedAt, gameData.endedAt);
        
        // 게임 상태 매핑 업데이트
        gameStateMapping.set(roomId, {
            gameId: gameData.gameId,
            currentRound: gameData.currentRound || 1,
            phase: gameData.phase || 'waiting'
        });

        console.log(`[Data Save] 게임 상태 저장 완료: ${roomId} -> ${gameData.gameId}`);
    } catch (error) {
        console.error(`[Data Save] 게임 상태 저장 실패: ${roomId}`, error);
    }
}

async function savePlayerAction(roomId, username, actionType, amount = 0, position = null) {
    try {
        const gameState = gameStateMapping.get(roomId);
        if (!gameState || !gameState.gameId) return;

        // 플레이어 액션 기록
        await db.recordPlayerAction(
            gameState.gameId,
            gameState.currentRound,
            username,
            actionType,
            amount,
            position
        );

        console.log(`[Data Save] 플레이어 액션 저장: ${username} - ${actionType} (${amount})`);
    } catch (error) {
        console.error(`[Data Save] 플레이어 액션 저장 실패: ${username}`, error);
    }
}

async function saveRoundState(roomId, roundData) {
    try {
        const gameState = gameStateMapping.get(roomId);
        if (!gameState || !gameState.gameId) return;

        // 라운드 상태 저장/업데이트
        if (roundData.isNewRound) {
            await db.createGameRound(
                gameState.gameId,
                roundData.roundNumber,
                roundData.phase,
                roundData.communityCards
            );
        } else {
            await db.updateRoundPot(gameState.gameId, roundData.roundNumber, roundData.potAmount);
        }

        // 게임 상태 매핑 업데이트
        gameStateMapping.set(roomId, {
            ...gameState,
            currentRound: roundData.roundNumber,
            phase: roundData.phase
        });

        console.log(`[Data Save] 라운드 상태 저장: ${roomId} - 라운드 ${roundData.roundNumber}`);
    } catch (error) {
        console.error(`[Data Save] 라운드 상태 저장 실패: ${roomId}`, error);
    }
}

async function saveGameResult(roomId, gameResult) {
    try {
        const gameState = gameStateMapping.get(roomId);
        if (!gameState || !gameState.gameId) return;

        // 게임 결과 저장
        await db.saveGameResult(
            gameState.gameId,
            gameResult.winner,
            gameResult.finalPot,
            gameResult.gameDuration
        );

        console.log(`[Data Save] 게임 결과 저장: ${roomId} - 승자: ${gameResult.winner}`);
    } catch (error) {
        console.error(`[Data Save] 게임 결과 저장 실패: ${roomId}`, error);
    }
}

// 게임 데이터베이스 초기화 함수
async function initializeGameDatabase(roomId, room) {
    try {
        const gameId = await db.createGame(roomId, room.name);
        if (gameId) {
            console.log(`[Database] 게임 초기화 완료: ${roomId} -> ${gameId}`);
            return gameId;
        }
    } catch (error) {
        console.error(`[Database] 게임 초기화 실패: ${roomId}`, error);
    }
    return null;
}

module.exports = function(ioInstance) {
    // 모듈 레벨에서 io 인스턴스 저장
    io = ioInstance;
    // 연결된 소켓을 추적하기 위한 Set
    const connectedSockets = new Set();
    
    // 사용자 등록 상태를 추적하기 위한 Map
    const registeredUsers = new Map(); // socket.id -> username

    function handleDisconnect(socket) {
        const username = socket.data?.username;
        console.log(`[Socket Disconnect] User disconnected: ${username || 'unknown'} (${socket.id})`);
        
        if (username && onlineUsers.has(username)) {
            onlineUsers.get(username).delete(socket.id);
            if (onlineUsers.get(username).size === 0) {
                onlineUsers.delete(username);
            }
            io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        }
        
        // 유저 상태 정리
        userStatus.delete(socket.id);
        
        // 모든 게임방을 순회하며 해당 유저를 제거
        gameRooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                // 게임이 진행 중인 방에서는 플레이어를 즉시 제거하지 않음
                if (room.state === 'playing') {
                    console.log(`[Socket Disconnect] 게임 진행 중인 방 ${roomId}에서 ${username || 'unknown'} 소켓 연결 끊어짐`);
                    // 플레이어 정보는 유지하되, 소켓 상태만 업데이트
                    const player = room.players.get(socket.id);
                    if (player) {
                        player.disconnected = true;
                        player.disconnectTime = new Date();
                        player.isOnline = false;  // 오프라인 상태로 표시
                        console.log(`[Socket Disconnect] ${username || 'unknown'} 플레이어를 오프라인으로 표시`);
                        
                        // 게임 상태 업데이트를 모든 플레이어에게 전송
                        io.to(roomId).emit('playerDisconnected', {
                            username: username,
                            message: `${username}님의 연결이 끊어졌습니다.`,
                            gameState: getRoomState(room)
                        });
                        
                        // 모든 플레이어에게 게임 상태 업데이트 전송
                        io.to(roomId).emit('gameStateUpdate', getRoomState(room));
                    }
                } else {
                    // 대기 중인 방에서는 기존과 동일하게 처리
                    // 마지막 유저인 경우 방 폭파 알림을 먼저 전송
                    if (room.players.size === 1) {
                        // 같은 방에 있던 모든 유저들에게 방 폭파 알림 전송 (나가기 전에)
                        io.to(roomId).emit('roomDestroyed', {
                            message: `방 "${room.name}"이 폭파되었습니다. (${username || 'unknown'}님 연결 끊김)`,
                            roomName: room.name,
                            roomId: roomId,
                            lastPlayer: username || 'unknown',
                            reason: 'disconnect'
                        });
                    }
                    
                    room.players.delete(socket.id);
                    console.log(`[Socket Disconnect] User ${username || 'unknown'} removed from room ${roomId}`);
                    
                    // 방에 아무도 없으면 방 삭제 (게임 중인 방은 30초, 일반 방은 10초 대기)
                    const isGameRoom = roomId.startsWith('game_') || roomId.startsWith('admin_');
                    const deleteDelay = isGameRoom ? 30000 : 10000; // 게임 방은 30초, 일반 방은 10초
                    
                    console.log(`[Room Cleanup] ${roomId} 방 삭제 예약 (${deleteDelay/1000}초 후)`);
                    
                    setTimeout(() => {
                        const targetRoom = gameRooms.get(roomId);
                        if (targetRoom && targetRoom.players.size === 0) {
                            gameRooms.delete(roomId);
                            // 게임 상태 매핑도 정리
                            gameStateMapping.delete(roomId);
                            console.log(`[Room Deleted] Room ${roomId} is empty and has been deleted (after ${deleteDelay/1000}s delay).`);
                            io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                                id: room.id,
                                name: room.name,
                                playerCount: room.players.size,
                                maxPlayers: room.maxPlayers,
                                state: room.state
                            })));
                        } else if (targetRoom) {
                            console.log(`[Room Kept] Room ${roomId} has ${targetRoom.players.size} players, keeping alive.`);
                        }
                    }, deleteDelay);
                }
            }
        });
        io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            playerCount: room.players.size,
            maxPlayers: room.maxPlayers,
            state: room.state
        })));
    }

    function getRoomState(room) {
        return {
            id: room.id,
            name: room.name,
            players: Array.from(room.players.values()).map(player => ({
                ...player,
                ready: player.ready === true,
                isHost: player.username === room.host,
                socketId: player.socketId, // 소켓 ID 포함
                isOnline: player.isOnline !== false // 기본값 true, 명시적으로 false가 아니면 온라인
            })),
            host: room.host,
            state: room.state,
            maxPlayers: room.maxPlayers || 4,
            gameMode: room.gameMode || 'beginner',
            communityCards: room.communityCards || [],
            phase: room.phase || 'waiting',
            currentRound: room.currentRound || 1,
            maxRounds: room.maxRounds || 5,
            pot: room.pot || 0,
            // 게임 진행 상태 추가
            centerChips: room.centerChips || [],
            currentPlayer: room.currentPlayer || 0,
            passedPlayers: room.passedPlayers ? Array.from(room.passedPlayers) : [],
            turnTimer: room.turnTimer || null,
            gameStats: room.gameStats || {},
            // 라운드별 상세 정보
            rounds: room.rounds || {},
            deck: room.deck || [],
            heistCards: room.heistCards || [],
            challengeCards: room.challengeCards || [],
            specialistCards: room.specialistCards || []
        };
    }
    
    async function startRoomGame(roomId) {
        console.log(`[startRoomGame] 함수 호출됨 - roomId: ${roomId}`);
        const room = gameRooms.get(roomId);
        if (!room || room.state !== 'waiting') {
            console.log(`[startRoomGame] 방을 찾을 수 없거나 대기 상태가 아님 - room:`, room);
            return;
        }

        console.log(`[startRoomGame] 방 정보 확인 - playerCount: ${room.players.size}, state: ${room.state}`);
        
        // 최소 2명의 플레이어가 필요
        if (room.players.size < 2) {
            console.error(`[Game Start] 최소 2명의 플레이어가 필요합니다. 현재: ${room.players.size}명`);
            return;
        }

        try {
            console.log(`[startRoomGame] 게임 데이터베이스 초기화 시작`);
            // 게임 데이터베이스 초기화
            const gameId = await initializeGameDatabase(roomId, room);
            if (!gameId) {
                console.error(`[Game Start] 게임 데이터베이스 초기화 실패: ${roomId}`);
                return;
            }

            console.log(`[startRoomGame] 게임 데이터베이스 초기화 성공 - gameId: ${gameId}`);
            room.state = 'playing';
            console.log(`[Game Start] Game starting in room ${roomId} with game ID: ${gameId}`);
            
            // The Gang 게임 초기화
            room.currentRound = 1;
            room.phase = 'waiting';
            room.deck = createDeck(); // 전체 게임에서 사용할 덱 생성
            room.communityCards = []; // 커뮤니티 카드
            room.centerChips = []; // 가운데 공용 칩들
            room.currentPlayer = 0; // 현재 턴 플레이어 인덱스
            room.passedPlayers = new Set(); // 패스한 플레이어들
            room.playerOrder = Array.from(room.players.keys()); // 플레이어 순서
            
            // 게임 모드 초기화 (room.gameMode가 설정되어 있으면 사용, 없으면 BASIC)
            const selectedMode = room.selectedGameMode || 'BASIC';
            initializeGameMode(room, selectedMode);
            
            room.players.forEach((player, socketId) => {
                player.cards = []; // 빈 카드 배열로 초기화
                player.cardsRevealed = false;
                player.chips = []; // 플레이어가 가진 칩들
                player.initialChips = 1000; // 초기 칩 수 저장
                player.passed = false; // 패스 상태
            });

            // 가운데에 기본 칩 배치 (플레이어 수만큼, 1라운드는 흰색)
            const playerCount = room.players.size;
            room.centerChips = [];
            for (let i = 1; i <= playerCount; i++) {
                room.centerChips.push({ id: `center${i}`, value: i * 10, color: 'white' });
            }

            // 게임 상태 저장
            await saveGameState(roomId, {
                gameId: gameId,
                status: 'playing',
                startedAt: new Date(),
                currentRound: 1,
                phase: 'waiting'
            });

            // 리플레이 기록 시작
            const recordingId = replayManager.startRecording(roomId, {
                gameId: gameId,
                players: room.players,
                gameMode: room.gameMode,
                challengeCards: room.challengeCards,
                specialistCards: room.specialistCards
            });

            // 실시간 통계 추적 시작
            statsManager.trackRealTimeStats(roomId, 'game_started', {
                gameId: gameId,
                players: Array.from(room.players.values()).map(p => p.username),
                gameMode: room.gameMode
            });

            // 모든 플레이어에게 게임 시작 알림
            io.to(roomId).emit('gameStarted', {
                gameId: gameId,
                recordingId: recordingId,
                players: Array.from(room.players.values()).map(player => ({
                    username: player.username,
                    chips: player.chips
                })),
                gameMode: room.gameMode,
                challengeCards: room.challengeCards || [],
                specialistCards: room.specialistCards || []
            });

            // 방 상태 업데이트를 모든 플레이어에게 전송
            const roomState = getRoomState(room);
            io.to(roomId).emit('roomStateUpdate', roomState);
            io.to(roomId).emit('gameStateUpdate', roomState);

            // 게임 시작 완료 - 자동으로 1라운드 시작
            console.log(`[Game Ready] 게임 준비 완료. 1라운드를 자동으로 시작합니다 - roomId: ${roomId}`);
            
            // 1초 후 자동으로 1라운드 시작
            setTimeout(() => {
                console.log(`[Auto Start] 게임 시작 후 자동으로 1라운드 시작 - roomId: ${roomId}`);
                initializeRound1(roomId, room);
            }, 1000);

        } catch (error) {
            console.error(`[Game Start] 게임 시작 실패: ${roomId}`, error);
            room.state = 'waiting';
        }
    }

    // Socket.io 연결 처리
    io.on('connection', (socket) => {
        console.log(`[Socket Connect] 새로운 소켓 연결: ${socket.id}`);
        connectedSockets.add(socket.id);
        
        let registered = false;

        // 사용자 등록 (registerUser 이벤트로 변경)
        socket.on('registerUser', (username) => {
            try {
                if (!username || username.trim() === '') {
                    socket.emit('error', { message: '사용자명이 올바르지 않습니다.' });
                    return;
                }

                registered = true;
                
                // 소켓에 사용자 정보 저장
                socket.data = { ...socket.data, username, isAdmin: false };
                
                // 온라인 사용자 목록에 추가
                if (!onlineUsers.has(username)) {
                    onlineUsers.set(username, new Set());
                }
                onlineUsers.get(username).add(socket.id);
                
                // 사용자 상태 저장
                userStatus.set(socket.id, {
                    username: username,
                    status: 'online',
                    location: 'lobby',
                    connectTime: new Date()
                });

                // 등록된 사용자 목록에 추가
                registeredUsers.set(socket.id, username);

                // 기존 방에서 해당 사용자의 소켓 ID 업데이트 (게임 페이지 재연결 시)
                let existingRoom = null;
                for (const [roomId, room] of gameRooms) {
                    for (const [oldSocketId, player] of room.players) {
                        if (player.username === username && oldSocketId !== socket.id) {
                            console.log(`[Register] 기존 방에서 플레이어 소켓 ID 업데이트: ${username}, ${oldSocketId} -> ${socket.id}`);
                            
                            // 플레이어 정보 업데이트
                            player.socketId = socket.id;
                            player.disconnected = false;
                            delete player.disconnectTime;
                            
                            room.players.delete(oldSocketId);
                            room.players.set(socket.id, player);
                            
                            // 새 소켓을 해당 방에 참여시킴
                            socket.join(roomId);
                            existingRoom = { roomId, room };
                            break;
                        }
                    }
                    if (existingRoom) break;
                }

                console.log(`[Register] 사용자 등록 완료: ${username} (${socket.id})`);
                
                // 클라이언트에 등록 성공 응답
                if (existingRoom) {
                    // 기존 게임 방이 있는 경우 게임으로 리다이렉트
                    console.log(`[Register] ${username} 기존 게임 방 발견: ${existingRoom.roomId}`);
                    socket.emit('registerUserSuccess', { 
                        username: username,
                        message: '사용자 등록이 완료되었습니다.',
                        redirectToGame: true,
                        roomId: existingRoom.roomId,
                        roomState: getRoomState(existingRoom.room)
                    });
                } else {
                    // 새로운 연결인 경우 로비로
                    socket.emit('registerUserSuccess', { 
                        username: username,
                        message: '사용자 등록이 완료되었습니다.',
                        redirectToGame: false
                    });
                }

                // 모든 클라이언트에 온라인 사용자 목록 업데이트
                io.emit('onlineUsers', Array.from(onlineUsers.keys()));

                // 방 목록 전송
                socket.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

            } catch (error) {
                console.error('[Register] 사용자 등록 실패:', error);
                socket.emit('error', { message: '사용자 등록에 실패했습니다.' });
            }
        });

        // 방 생성
        socket.on('createRoom', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomName, maxPlayers = 4, gameMode = 'beginner' } = data;
                
                if (!roomName || roomName.trim() === '') {
                    socket.emit('error', { message: '방 이름을 입력해주세요.' });
                    return;
                }

                // 방 ID 생성
                const roomId = `room_${uuidv4()}`;
                
                // 새 방 생성
                const newRoom = {
                    id: roomId,
                    name: roomName,
                    players: new Map(),
                    maxPlayers: maxPlayers,
                    host: username,
                    state: 'waiting',
                    gameMode: gameMode, // 클라이언트에서 받은 게임 모드
                    createdAt: new Date()
                };

                // 방에 호스트 추가 (방장도 기본적으로 미준비 상태)
                newRoom.players.set(socket.id, {
                    socketId: socket.id,
                    username: username,
                    isHost: true,
                    ready: false, // 방장도 기본적으로 미준비 상태
                    joinTime: new Date(),
                    disconnected: false
                });

                // 방 목록에 추가
                gameRooms.set(roomId, newRoom);

                // 방 생성자에게 방 생성 성공 응답
                socket.emit('roomCreated', {
                    roomId: roomId,
                    room: getRoomState(newRoom)
                });

                // 방 생성자를 새로 생성된 방에 입장시킴
                socket.join(roomId);

                // 방 생성자에게 방 상태 업데이트 전송
                const roomState = getRoomState(newRoom);
                socket.emit('roomStateUpdate', roomState);

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Create Room] 방 생성 완료: ${roomName} (${roomId}) by ${username}`);

            } catch (error) {
                console.error('[Create Room] 방 생성 실패:', error);
                socket.emit('error', { message: '방 생성에 실패했습니다.' });
            }
        });

        // 방 입장
        socket.on('joinRoom', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (room.state !== 'waiting') {
                    socket.emit('error', { message: '게임이 이미 진행 중인 방입니다.' });
                    return;
                }

                if (room.players.size >= room.maxPlayers) {
                    socket.emit('error', { message: '방이 가득 찼습니다.' });
                    return;
                }

                // 이미 방에 있는지 확인
                if (room.players.has(socket.id)) {
                    socket.emit('error', { message: '이미 방에 입장해 있습니다.' });
                    return;
                }

                // 방에 입장 (새로 입장하는 플레이어는 기본적으로 미준비 상태)
                room.players.set(socket.id, {
                    socketId: socket.id,
                    username: username,
                    isHost: false,
                    isOnline: true,  // 온라인 상태 명시
                    ready: false, // 새로 입장하는 플레이어는 미준비 상태
                    joinTime: new Date(),
                    disconnected: false
                });
                
                // 새 사용자 입장 시 모든 유저의 준비 상태 해제
                room.players.forEach(player => {
                    player.ready = false;
                });

                // 소켓을 방에 참여시킴
                socket.join(roomId);

                // 방 입장 성공 응답 (클라이언트가 기대하는 이벤트명으로 변경)
                socket.emit('joinRoomSuccess', getRoomState(room));

                // 방의 모든 플레이어에게 방 상태 업데이트 전송
                const roomState = getRoomState(room);
                
                // 방의 다른 플레이어들에게 새 플레이어 입장 알림
                socket.to(roomId).emit('playerJoined', {
                    username: username,
                    playerCount: room.players.size,
                    gameState: roomState
                });

                // 모든 플레이어에게 게임 상태 업데이트 전송
                io.to(roomId).emit('roomStateUpdate', roomState);
                io.to(roomId).emit('gameStateUpdate', roomState);

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Join Room] ${username}이(가) 방 ${roomId}에 입장했습니다.`);

            } catch (error) {
                console.error('[Join Room] 방 입장 실패:', error);
                socket.emit('error', { message: '방 입장에 실패했습니다.' });
            }
        });

        // 방 나가기
        socket.on('leaveRoom', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                // 사용자가 속한 방 찾기
                let room = null;
                let roomId = null;
                for (const [id, r] of gameRooms) {
                    if (r.players.has(socket.id)) {
                        room = r;
                        roomId = id;
                        break;
                    }
                }
                
                if (!room) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                // 게임 진행 중이면 게임 중지
                if (room.state === 'playing') {
                    console.log(`[Leave Room] ${username}이(가) 게임 중 방을 나가서 게임을 중지합니다.`);
                    
                    // 게임 상태를 대기 상태로 변경
                    room.state = 'waiting';
                    room.phase = 'waiting';
                    room.currentRound = 0;
                    room.currentPlayer = null;
                    room.currentTurn = 0;
                    
                    // 타이머가 있으면 정리
                    if (room.turnTimer) {
                        clearTimeout(room.turnTimer);
                        room.turnTimer = null;
                    }
                    
                    // 모든 플레이어 준비 상태 초기화
                    room.players.forEach(player => {
                        player.ready = false;
                        player.cards = [];
                        player.chips = [];
                        player.passed = false;
                    });
                    
                    // 게임 중지 알림
                    io.to(roomId).emit('gameStopped', {
                        message: `${username}님이 방을 나가서 게임이 중지되었습니다.`,
                        gameState: getRoomState(room)
                    });
                }

                // 마지막 유저인 경우 방 폭파 알림을 먼저 전송
                if (room.players.size === 1) {
                    // 같은 방에 있던 모든 유저들에게 방 폭파 알림 전송 (나가기 전에)
                    io.to(roomId).emit('roomDestroyed', {
                        message: `방 "${room.name}"이 폭파되었습니다. (마지막 유저: ${username})`,
                        roomName: room.name,
                        roomId: roomId,
                        lastPlayer: username
                    });
                }

                // 방에서 나가기
                room.players.delete(socket.id);
                socket.leave(roomId);

                // 방 나가기 성공 응답
                socket.emit('leftRoomSuccess');

                // 방에 아무도 없으면 방 삭제
                if (room.players.size === 0) {
                    console.log(`[Leave Room] 방 ${roomId}가 비어서 삭제됩니다. 마지막 유저: ${username}`);
                    gameRooms.delete(roomId);
                    console.log(`[Leave Room] 방 ${roomId}가 비어서 삭제되었습니다.`);
                } else {
                    // 방의 다른 플레이어들에게 플레이어 퇴장 알림 및 상태 업데이트
                    const updatedRoomState = getRoomState(room);
                    socket.to(roomId).emit('playerLeft', {
                        username: username,
                        playerCount: room.players.size,
                        gameState: updatedRoomState
                    });
                    
                    // 모든 플레이어에게 게임 상태 업데이트 전송
                    socket.to(roomId).emit('gameStateUpdate', updatedRoomState);
                    
                    // 호스트가 나간 경우 새로운 호스트 지정
                    if (room.host === username) {
                        const newHost = room.players.values().next().value;
                        room.host = newHost.username;
                        newHost.isHost = true;
                        console.log(`[Leave Room] 새로운 호스트: ${newHost.username}`);
                    }
                }

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Leave Room] ${username}이(가) 방 ${roomId}에서 나갔습니다.`);

            } catch (error) {
                console.error('[Leave Room] 방 나가기 실패:', error);
                socket.emit('error', { message: '방 나가기에 실패했습니다.' });
            }
        });

        // 준비 상태 토글
        socket.on('toggleReady', () => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                // 사용자가 속한 방 찾기
                let userRoom = null;
                for (const [roomId, room] of gameRooms) {
                    if (room.players.has(socket.id)) {
                        userRoom = room;
                        break;
                    }
                }

                if (!userRoom) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                // 플레이어의 준비 상태 토글
                const player = userRoom.players.get(socket.id);
                if (player) {
                    player.ready = !player.ready;
                    console.log(`[Toggle Ready] ${username} 준비 상태: ${player.ready ? '준비' : '미준비'}`);

                    // 방의 모든 플레이어에게 상태 업데이트 전송
                    const roomState = getRoomState(userRoom);
                    io.to(userRoom.id).emit('roomStateUpdate', roomState);
                }

            } catch (error) {
                console.error('[Toggle Ready] 준비 상태 토글 실패:', error);
                socket.emit('error', { message: '준비 상태 변경에 실패했습니다.' });
            }
        });

        // The Gang 1라운드 시작
        socket.on('startRound1', async (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (room.host !== username) {
                    socket.emit('error', { message: '호스트만 라운드를 시작할 수 있습니다.' });
                    return;
                }

                if (room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 시작된 상태가 아닙니다.' });
                    return;
                }

                // 1라운드 초기화
                initializeRound1(roomId, room);

            } catch (error) {
                console.error('[Start Round1] 1라운드 시작 실패:', error);
                socket.emit('error', { message: '1라운드 시작에 실패했습니다.' });
            }
        });

        // 게임 시작
        socket.on('startGame', async (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (room.host !== username) {
                    socket.emit('error', { message: '호스트만 게임을 시작할 수 있습니다.' });
                    return;
                }

                if (room.players.size < 2) {
                    socket.emit('error', { message: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' });
                    return;
                }

                // 게임 시작
                await startRoomGame(roomId);

            } catch (error) {
                console.error('[Start Game] 게임 시작 실패:', error);
                socket.emit('error', { message: '게임 시작에 실패했습니다.' });
            }
        });

        // 방 게임 시작 (startRoomGame 이벤트)
        socket.on('startRoomGame', async (data) => {
            try {
                console.log('[Start Room Game] 이벤트 수신:', data);
                const username = socket.data?.username;
                if (!registered || !username) {
                    console.log('[Start Room Game] 사용자 등록 안됨');
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                console.log('[Start Room Game] roomId:', roomId);
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    console.log('[Start Room Game] 방을 찾을 수 없음');
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                console.log('[Start Room Game] 방 정보:', {
                    host: room.host,
                    username: username,
                    playerCount: room.players.size,
                    state: room.state
                });

                if (room.host !== username) {
                    console.log('[Start Room Game] 호스트가 아님');
                    socket.emit('error', { message: '호스트만 게임을 시작할 수 있습니다.' });
                    return;
                }

                if (room.players.size < 2) {
                    console.log('[Start Room Game] 플레이어 수 부족');
                    socket.emit('error', { message: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' });
                    return;
                }

                // 모든 플레이어가 준비되었는지 확인
                const allReady = Array.from(room.players.values()).every(player => player.ready);
                console.log('[Start Room Game] 모든 플레이어 준비 상태:', allReady);
                console.log('[Start Room Game] 플레이어 준비 상태:', Array.from(room.players.values()).map(p => ({ username: p.username, ready: p.ready })));
                
                if (!allReady) {
                    console.log('[Start Room Game] 모든 플레이어가 준비되지 않음');
                    socket.emit('error', { message: '모든 플레이어가 준비되어야 합니다.' });
                    return;
                }

                console.log('[Start Room Game] 게임 시작 조건 만족, startRoomGame 함수 호출');
                // 게임 시작
                await startRoomGame(roomId);

            } catch (error) {
                console.error('[Start Room Game] 게임 시작 실패:', error);
                socket.emit('error', { message: '게임 시작에 실패했습니다.' });
            }
        });

        // 카드 받기 (더 이상 필요하지 않음 - 라운드 시작 시 자동 분배)
        socket.on('getCards', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                if (room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                // 라운드가 시작된 경우, 이미 카드가 분배되어 있으므로 오류 메시지
                if (room.phase && ['round1', 'round2', 'round3', 'round4'].includes(room.phase)) {
                    socket.emit('error', { message: '라운드가 진행 중입니다. 카드는 이미 분배되었습니다.' });
                    return;
                }

                const player = room.players.get(socket.id);
                
                // 이미 카드를 받았는지 확인
                if (player.cards && player.cards.length > 0) {
                    socket.emit('error', { message: '이미 카드를 받았습니다.' });
                    return;
                }

                // 카드 분배 (간단한 랜덤 카드)
                const suits = ['♠', '♥', '♦', '♣'];
                const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
                
                const card1 = {
                    suit: suits[Math.floor(Math.random() * suits.length)],
                    value: values[Math.floor(Math.random() * values.length)]
                };
                
                const card2 = {
                    suit: suits[Math.floor(Math.random() * suits.length)],
                    value: values[Math.floor(Math.random() * values.length)]
                };

                player.cards = [card1, card2];
                player.cardsRevealed = false;

                // 플레이어에게 카드 전송
                socket.emit('cardsReceived', {
                    cards: player.cards,
                    message: '카드를 받았습니다.'
                });

                // 다른 플레이어들에게 카드 받기 완료 알림
                socket.to(roomId).emit('playerGotCards', {
                    username: username,
                    message: `${username}이(가) 카드를 받았습니다.`
                });

                console.log(`[Get Cards] ${username}이(가) 카드를 받았습니다.`);

            } catch (error) {
                console.error('[Get Cards] 카드 받기 실패:', error);
                socket.emit('error', { message: '카드 받기에 실패했습니다.' });
            }
        });

        // 카드 공개
        socket.on('revealCards', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                if (room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                const player = room.players.get(socket.id);
                
                if (!player.cards || player.cards.length === 0) {
                    socket.emit('error', { message: '먼저 카드를 받아주세요.' });
                    return;
                }

                if (player.cardsRevealed) {
                    socket.emit('error', { message: '이미 카드를 공개했습니다.' });
                    return;
                }

                // 카드 공개
                player.cardsRevealed = true;

                // 모든 플레이어에게 카드 공개 알림
                io.to(roomId).emit('cardsRevealed', {
                    username: username,
                    cards: player.cards,
                    message: `${username}의 카드가 공개되었습니다.`
                });

                console.log(`[Reveal Cards] ${username}의 카드가 공개되었습니다.`);

            } catch (error) {
                console.error('[Reveal Cards] 카드 공개 실패:', error);
                socket.emit('error', { message: '카드 공개에 실패했습니다.' });
            }
        });

        // 다음 라운드
        socket.on('nextRound', async (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                if (room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                if (room.host !== username) {
                    socket.emit('error', { message: '호스트만 다음 라운드로 진행할 수 있습니다.' });
                    return;
                }

                // 현재 라운드 증가
                room.currentRound = (room.currentRound || 1) + 1;
                
                // 최대 라운드에 도달했는지 확인
                if (room.currentRound > (room.maxRounds || 5)) {
                    // 게임 종료
                    room.state = 'finished';
                    
                    // 게임 결과 계산 (간단한 예시)
                    const players = Array.from(room.players.values());
                    const winner = players[Math.floor(Math.random() * players.length)];
                    
                    // 게임 결과 저장
                    await saveGameResult(roomId, {
                        winner: winner.username,
                        finalPot: room.pot || 0,
                        gameDuration: Date.now() - room.createdAt
                    });

                    // 모든 플레이어에게 게임 종료 알림
                    io.to(roomId).emit('gameEnded', {
                        winner: winner.username,
                        finalPot: room.pot || 0,
                        message: '게임이 종료되었습니다.'
                    });

                    console.log(`[Next Round] 게임 종료 - 승자: ${winner.username}`);
                } else {
                    // 다음 라운드 시작
                    room.phase = 'waiting';
                    
                    // 모든 플레이어의 카드 초기화
                    room.players.forEach((player, socketId) => {
                        player.cards = [];
                        player.cardsRevealed = false;
                    });

                    // 모든 플레이어에게 다음 라운드 알림
                    io.to(roomId).emit('nextRoundStarted', {
                        round: room.currentRound,
                        message: `${room.currentRound}라운드가 시작되었습니다.`
                    });

                    console.log(`[Next Round] ${room.currentRound}라운드 시작`);
                }

                // 라운드 상태 저장
                await saveRoundState(roomId, {
                    isNewRound: true,
                    roundNumber: room.currentRound,
                    phase: room.phase,
                    communityCards: room.communityCards || []
                });

            } catch (error) {
                console.error('[Next Round] 라운드 진행 실패:', error);
                socket.emit('error', { message: '라운드 진행에 실패했습니다.' });
            }
        });

        // 게임 포기
        socket.on('giveUpGame', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                // 게임 포기 처리
                console.log(`[Give Up Game] ${username}이(가) 게임을 포기했습니다.`);
                
                // 모든 플레이어에게 게임 포기 알림
                io.to(roomId).emit('gameEndedByGiveUp', {
                    reason: `${username}이(가) 게임을 포기했습니다.`,
                    roomId: roomId
                });

                // 방 상태를 대기 중으로 변경
                room.state = 'waiting';
                
                // 모든 플레이어의 준비 상태 초기화
                room.players.forEach(player => {
                    player.ready = false;
                });

                // 방 상태 업데이트 전송
                const roomState = getRoomState(room);
                io.to(roomId).emit('roomStateUpdate', roomState);

            } catch (error) {
                console.error('[Give Up Game] 게임 포기 처리 실패:', error);
                socket.emit('error', { message: '게임 포기 처리에 실패했습니다.' });
            }
        });

        // 게임 방 재입장 (게임 페이지에서 사용)
        socket.on('rejoinRoom', (data) => {
            try {
                const username = socket.data?.username;
                console.log(`[Rejoin Room] 시도 - username: ${username}, registered: ${registered}, socketId: ${socket.id}`);
                
                if (!registered || !username) {
                    console.log(`[Rejoin Room] 사용자 등록 안됨 - registered: ${registered}, username: ${username}`);
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                console.log(`[Rejoin Room] 방 찾기 - roomId: ${roomId}`);
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    console.log(`[Rejoin Room] 방을 찾을 수 없음 - roomId: ${roomId}`);
                    console.log(`[Rejoin Room] 현재 존재하는 방들:`, Array.from(gameRooms.keys()));
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    socket.emit('redirectToLobby', { message: '방이 존재하지 않아 로비로 이동합니다.' });
                    return;
                }

                console.log(`[Rejoin Room] 방 정보:`, {
                    id: room.id,
                    name: room.name,
                    host: room.host,
                    playerCount: room.players.size,
                    players: Array.from(room.players.values()).map(p => ({ username: p.username, socketId: p.socketId }))
                });

                // 플레이어가 해당 방에 속해있는지 확인
                let playerExists = false;
                let oldPlayer = null;
                for (const [socketId, player] of room.players) {
                    console.log(`[Rejoin Room] 플레이어 확인 - socketId: ${socketId}, player.username: ${player.username}, 찾는 username: ${username}, disconnected: ${player.disconnected}`);
                    if (player.username === username) {
                        // 기존 소켓 ID를 새로운 소켓 ID로 업데이트
                        room.players.delete(socketId);
                        
                        // 재연결 정보 업데이트
                        player.disconnected = false;
                        player.isOnline = true;  // 온라인 상태로 변경
                        delete player.disconnectTime;
                        
                        room.players.set(socket.id, player);
                        playerExists = true;
                        oldPlayer = player;
                        console.log(`[Rejoin Room] 플레이어 재연결 성공 - 기존 socketId: ${socketId}, 새 socketId: ${socket.id}`);
                        break;
                    }
                }

                if (!playerExists) {
                    console.log(`[Rejoin Room] 플레이어를 찾을 수 없음 - username: ${username}`);
                    console.log(`[Rejoin Room] 방의 모든 플레이어:`, Array.from(room.players.values()).map(p => p.username));
                    socket.emit('error', { message: '해당 방의 플레이어가 아닙니다.' });
                    socket.emit('redirectToLobby', { message: '방에 속하지 않아 로비로 이동합니다.' });
                    return;
                }

                // 소켓을 방에 참여시킴
                socket.join(roomId);

                // 게임 상태 전송
                const roomState = getRoomState(room);
                socket.emit('rejoinRoomSuccess', roomState);
                
                // 모든 플레이어에게 재연결 알림 및 상태 업데이트
                io.to(roomId).emit('playerReconnected', {
                    username: username,
                    message: `${username}님이 다시 연결되었습니다.`,
                    gameState: roomState
                });
                
                // 모든 플레이어에게 게임 상태 업데이트 전송
                io.to(roomId).emit('gameStateUpdate', roomState);

                // 게임이 진행 중인 경우 추가 상태 전송
                if (room.state === 'playing') {
                    console.log(`[Rejoin Room] 게임 진행 중 상태 복원 - ${username}`);
                    
                    // 플레이어별 개인 정보 전송 (자신의 카드 등)
                    if (oldPlayer) {
                        console.log(`[Rejoin Room] 개인 상태 전송:`, {
                            cards: oldPlayer.cards,
                            chips: oldPlayer.chips,
                            passed: oldPlayer.passed,
                            cardsRevealed: oldPlayer.cardsRevealed
                        });
                        
                        socket.emit('personalGameState', {
                            cards: oldPlayer.cards || [],
                            chips: oldPlayer.chips || [],
                            passed: oldPlayer.passed || false,
                            ready: oldPlayer.ready || false,
                            cardsRevealed: oldPlayer.cardsRevealed || false
                        });
                        
                        // 카드가 있는 경우 개별적으로 카드 수신 이벤트도 전송
                        if (oldPlayer.cards && oldPlayer.cards.length > 0) {
                            socket.emit('cardsReceived', {
                                cards: oldPlayer.cards,
                                message: '재접속으로 인한 카드 복원'
                            });
                        }
                    }

                    // 현재 턴 정보 전송
                    if (room.currentPlayer !== undefined) {
                        const playerSocketIds = Array.from(room.players.keys());
                        const currentSocketId = playerSocketIds[room.currentPlayer];
                        const currentPlayerInfo = room.players.get(currentSocketId);
                        
                        console.log(`[Rejoin Room] 턴 정보 전송:`, {
                            currentPlayer: room.currentPlayer,
                            currentPlayerName: currentPlayerInfo?.username,
                            isYourTurn: currentPlayerInfo?.username === username
                        });
                        
                        socket.emit('turnInfo', {
                            currentPlayer: room.currentPlayer,
                            currentPlayerName: currentPlayerInfo?.username,
                            isYourTurn: currentPlayerInfo?.username === username
                        });
                        
                        // 내 턴인 경우 턴 알림도 전송
                        if (currentPlayerInfo?.username === username) {
                            socket.emit('yourTurn', {
                                message: '재접속: 당신의 턴입니다.',
                                gameState: getGameState(room)
                            });
                        }
                    }

                    // 라운드별 상태 정보 전송
                    socket.emit('roundStateUpdate', {
                        currentRound: room.currentRound,
                        phase: room.phase,
                        communityCards: room.communityCards || [],
                        centerChips: room.centerChips || [],
                        passedPlayers: room.passedPlayers ? Array.from(room.passedPlayers) : []
                    });

                    // 타이머 정보 전송
                    if (room.turnTimer) {
                        socket.emit('timerUpdate', {
                            timeLeft: room.turnTimer.timeLeft || 30,
                            totalTime: room.turnTimer.totalTime || 30
                        });
                    }
                }

                // 다른 플레이어들에게 재연결 알림
                socket.to(roomId).emit('playerReconnected', {
                    username: username,
                    message: `${username}님이 다시 연결되었습니다.`,
                    gameState: getRoomState(room)
                });

                console.log(`[Rejoin Room] ${username}이(가) 방 ${roomId}에 재입장했습니다.`);

            } catch (error) {
                console.error('[Rejoin Room] 방 재입장 실패:', error);
                socket.emit('error', { message: '방 재입장에 실패했습니다.' });
                socket.emit('redirectToLobby', { message: '오류로 인해 로비로 이동합니다.' });
            }
        });

        // 게임 설정 업데이트
        socket.on('updateGameSettings', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId, gameMode, maxPlayers } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (room.host !== username) {
                    socket.emit('error', { message: '방장만 게임 설정을 변경할 수 있습니다.' });
                    return;
                }

                if (room.state !== 'waiting') {
                    socket.emit('error', { message: '게임이 진행 중일 때는 설정을 변경할 수 없습니다.' });
                    return;
                }

                // 설정 업데이트
                if (gameMode) {
                    room.gameMode = gameMode;
                }
                
                if (maxPlayers) {
                    // 현재 인원보다 적게 설정하려는 경우 방지
                    if (maxPlayers < room.players.size) {
                        socket.emit('error', { message: `현재 플레이어 수(${room.players.size}명)보다 적게 설정할 수 없습니다.` });
                        return;
                    }
                    room.maxPlayers = maxPlayers;
                }

                // 설정 변경 시 모든 플레이어 준비 상태 해지
                room.players.forEach(player => {
                    player.ready = false;
                });

                // 방의 모든 플레이어에게 설정 변경 및 상태 업데이트 전송
                const roomState = getRoomState(room);
                io.to(roomId).emit('roomStateUpdate', roomState);
                io.to(roomId).emit('gameSettingsUpdated', {
                    gameMode: room.gameMode,
                    maxPlayers: room.maxPlayers
                });

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Update Game Settings] ${username}이(가) 방 ${roomId}의 설정을 변경했습니다. gameMode: ${gameMode}, maxPlayers: ${maxPlayers}`);

            } catch (error) {
                console.error('[Update Game Settings] 게임 설정 업데이트 실패:', error);
                socket.emit('error', { message: '게임 설정 업데이트에 실패했습니다.' });
            }
        });

        // The Gang 플레이어 액션 처리
        socket.on('playerAction', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId, action, targetId } = data;
                
                console.log('\n=== [SERVER RECEIVED] ===');
                console.log('Player:', username);
                console.log('Room ID:', roomId);
                console.log('Action:', action);
                console.log('Target ID:', targetId);
                
                const room = gameRooms.get(roomId);
                
                if (!room || room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                // 라운드 단계 확인 (round1, round2, round3, round4만 허용)
                if (!['round1', 'round2', 'round3', 'round4'].includes(room.phase)) {
                    socket.emit('error', { message: '플레이어 액션을 할 수 있는 단계가 아닙니다.' });
                    return;
                }

                // 턴 체크 제거 - 누구든 언제든 액션 가능

                // 액션 처리
                handlePlayerAction(roomId, room, socket.id, action, targetId);

            } catch (error) {
                console.error('[Player Action] 액션 처리 실패:', error);
                socket.emit('error', { message: '액션 처리에 실패했습니다.' });
            }
        });

        // 스페셜리스트 카드 사용
        socket.on('useSpecialistCard', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId, cardId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room || room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                // 스페셜리스트 카드 사용
                const result = useSpecialistCard(room, cardId, socket.id);
                
                if (result.success) {
                    // 모든 플레이어에게 알림
                    io.to(roomId).emit('specialistCardUsed', {
                        username: username,
                        cardId: cardId,
                        message: result.message
                    });
                } else {
                    socket.emit('error', { message: result.message });
                }

            } catch (error) {
                console.error('[Specialist Card] 카드 사용 실패:', error);
                socket.emit('error', { message: '카드 사용에 실패했습니다.' });
            }
        });

        // 게임 상태 요청 처리
        socket.on('requestGameState', (data) => {
            const { roomId } = data;
            const room = gameRooms.get(roomId);
            
            if (room) {
                socket.emit('gameStateUpdate', getGameState(room));
            }
        });
        
        // 게임 모드 설정
        socket.on('setGameMode', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId, gameMode } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '방을 찾을 수 없습니다.' });
                    return;
                }

                // 호스트만 게임 모드 설정 가능
                const player = room.players.get(socket.id);
                if (!player || !player.isHost) {
                    socket.emit('error', { message: '호스트만 게임 모드를 설정할 수 있습니다.' });
                    return;
                }

                // 게임이 진행 중이 아닐 때만 변경 가능
                if (room.state === 'playing') {
                    socket.emit('error', { message: '게임 진행 중에는 모드를 변경할 수 없습니다.' });
                    return;
                }

                // 게임 모드 설정
                room.selectedGameMode = gameMode;
                
                // 모든 플레이어에게 알림
                io.to(roomId).emit('gameModeChanged', {
                    gameMode: gameMode,
                    message: `게임 모드가 ${gameMode}로 변경되었습니다.`
                });

            } catch (error) {
                console.error('[Game Mode] 모드 설정 실패:', error);
                socket.emit('error', { message: '게임 모드 설정에 실패했습니다.' });
            }
        });

        // 게임 종료
        socket.on('endGame', async (data) => {
            try {
                const username = socket.data?.username;
                const { roomId, gameResult } = data;
                const room = gameRooms.get(roomId);
                
                if (!room || room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }
                
                // 게임 결과를 데이터베이스에 저장
                await saveGameResult(roomId, gameResult);
                
                // 게임 상태를 종료로 변경
                room.state = 'finished';
                
                // 모든 플레이어에게 게임 종료 알림
                io.to(roomId).emit('gameEnded', {
                    gameResult: gameResult,
                    finalStats: {
                        totalPot: room.pot,
                        players: Array.from(room.players.values()).map(player => ({
                            username: player.username,
                            finalChips: player.chips,
                            chipsChange: player.chips - (player.initialChips || 1000)
                        }))
                    }
                });
                
                console.log(`[End Game] 게임 종료 - 방 ID: ${roomId}`);
                
            } catch (error) {
                console.error('[End Game] 게임 종료 처리 실패:', error);
                socket.emit('error', { message: '게임 종료 처리에 실패했습니다.' });
            }
        });

        // 플레이어 패스 처리
        socket.on('playerPass', async (data) => {
            try {
                const username = socket.data?.username;
                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room || room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }
                
                const player = room.players.get(socket.id);
                if (!player) {
                    socket.emit('error', { message: '방에 참가하지 않았습니다.' });
                    return;
                }
                
                // 패스 상태 설정
                player.hasPassed = true;
                
                // 모든 플레이어에게 패스 알림 전송
                io.to(roomId).emit('playerPassed', {
                    username: username,
                    playerId: socket.id,
                    message: `${username}님이 패스했습니다.`
                });
                
                console.log(`[Player Pass] ${username}님이 패스함`);
                
                // 모든 플레이어가 패스했는지 확인
                const allPlayersPassed = Array.from(room.players.values()).every(p => p.hasPassed);
                
                if (allPlayersPassed) {
                    console.log(`[Round End] 모든 플레이어가 패스했습니다. 라운드 종료.`);
                    
                    // 모든 플레이어의 패스 상태 초기화
                    room.players.forEach(p => p.hasPassed = false);
                    
                    // 라운드 종료 알림
                    io.to(roomId).emit('roundEnded', {
                        round: room.currentRound,
                        reason: 'all_passed',
                        message: '모든 플레이어가 패스하여 라운드가 종료되었습니다.',
                        nextRound: room.currentRound + 1
                    });
                    
                    // 다음 라운드 준비 또는 게임 종료
                    setTimeout(() => {
                        prepareNextRound(room, roomId);
                    }, 2000); // 2초 후 다음 라운드
                    
                } else {
                    // 게임 상태 업데이트 전송
                    const gameStateUpdate = {
                        players: Array.from(room.players.values()),
                        phase: room.phase,
                        currentRound: room.currentRound
                    };
                    
                    io.to(roomId).emit('gameStateUpdate', gameStateUpdate);
                }
                
            } catch (error) {
                console.error('[Player Pass] 패스 처리 실패:', error);
                socket.emit('error', { message: '패스 처리에 실패했습니다.' });
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket Disconnect Event] 소켓 연결 해제 - socketId: ${socket.id}, 이유: ${reason}`);
            console.log(`[Socket Disconnect Event] registered 상태: ${registered}`);
            console.log(`[Socket Disconnect Event] socket.data:`, socket.data);
            handleDisconnect(socket);
        });
    }); // io.on('connection') 블록 끝

    // 온라인 유저 상태 조회 함수 (외부에서 접근 가능)
    function getOnlineUsersStatus() {
        console.log('[getOnlineUsersStatus] 호출됨');
        console.log('[getOnlineUsersStatus] onlineUsers 크기:', onlineUsers.size);
        console.log('[getOnlineUsersStatus] userStatus 크기:', userStatus.size);
        
        const statusList = [];
        
        onlineUsers.forEach((socketIds, username) => {
            console.log(`[getOnlineUsersStatus] 사용자 ${username}의 소켓들:`, Array.from(socketIds));
            
            // 각 사용자의 첫 번째 소켓 정보를 사용
            const firstSocketId = socketIds.values().next().value;
            console.log(`[getOnlineUsersStatus] 첫 번째 소켓 ID: ${firstSocketId}`);
            
            if (firstSocketId && userStatus.has(firstSocketId)) {
                const status = userStatus.get(firstSocketId);
                console.log(`[getOnlineUsersStatus] 상태 정보:`, status);
                statusList.push({
                    username: status.username,
                    status: status.status,
                    location: status.location,
                    connectTime: status.connectTime
                });
            } else {
                console.log(`[getOnlineUsersStatus] 소켓 ID ${firstSocketId}의 상태를 찾을 수 없음`);
            }
        });
        
        console.log('[getOnlineUsersStatus] 반환할 상태 목록:', statusList);
        return statusList;
    }
    
    // 유저 상태 업데이트 함수
    function updateUserStatus(socketId, status, location = null) {
        if (userStatus.has(socketId)) {
            const currentStatus = userStatus.get(socketId);
            currentStatus.status = status;
            currentStatus.location = location;
            userStatus.set(socketId, currentStatus);
        }
    }

    // 외부에서 접근 가능한 함수들
    return {
        getOnlineUsersStatus
    };
};