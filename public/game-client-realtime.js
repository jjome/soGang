// 실시간 데이터 저장을 지원하는 게임 클라이언트
class RealtimeGameClient {
    constructor(socket, roomId, username) {
        this.socket = socket;
        this.roomId = roomId;
        this.username = username;
        this.gameState = {
            currentRound: 1,
            phase: 'waiting',
            pot: 0,
            communityCards: [],
            players: [],
            myCards: [],
            myChips: 1000
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 게임 시작 이벤트
        this.socket.on('gameStarted', (data) => {
            console.log('[Game Client] 게임 시작됨:', data);
            this.gameState = { ...this.gameState, ...data.gameState };
            this.updateGameUI();
        });

        // 카드 분배 완료 이벤트
        this.socket.on('cardsDealt', (data) => {
            console.log('[Game Client] 카드 분배 완료:', data);
            this.gameState.currentRound = data.currentRound;
            this.gameState.phase = data.phase;
            this.gameState.pot = data.pot;
            
            // 내 카드 찾기
            const myPlayer = data.players.find(p => p.username === this.username);
            if (myPlayer) {
                this.gameState.myCards = myPlayer.cards;
                this.gameState.myChips = myPlayer.chips;
            }
            
            this.updateGameUI();
            this.showActionButtons();
        });

        // 플레이어 액션 이벤트
        this.socket.on('playerAction', (data) => {
            console.log('[Game Client] 플레이어 액션:', data);
            this.gameState.pot = data.pot;
            
            // 플레이어 칩 업데이트
            const player = this.gameState.players.find(p => p.username === data.username);
            if (player) {
                player.chips = data.chips;
            }
            
            this.updateGameUI();
        });

        // 새 라운드 시작 이벤트
        this.socket.on('roundStarted', (data) => {
            console.log('[Game Client] 새 라운드 시작:', data);
            this.gameState.currentRound = data.roundNumber;
            this.gameState.phase = data.phase;
            this.gameState.communityCards = data.communityCards || [];
            
            this.updateGameUI();
            this.showActionButtons();
        });

        // 게임 종료 이벤트
        this.socket.on('gameEnded', (data) => {
            console.log('[Game Client] 게임 종료:', data);
            this.showGameResults(data);
        });

        // 에러 이벤트
        this.socket.on('error', (data) => {
            console.error('[Game Client] 에러:', data);
            this.showError(data.message);
        });
    }

    // 카드 받기 요청
    requestCards() {
        console.log('[Game Client] 카드 받기 요청');
        this.socket.emit('requestCards', {
            roomId: this.roomId
        });
    }

    // 플레이어 액션 전송
    sendAction(actionType, amount = 0) {
        console.log('[Game Client] 액션 전송:', actionType, amount);
        this.socket.emit('playerAction', {
            roomId: this.roomId,
            username: this.username,
            actionType: actionType,
            amount: amount
        });
    }

    // 다음 라운드로 진행
    nextRound(roundNumber, phase, communityCards) {
        console.log('[Game Client] 다음 라운드:', roundNumber, phase);
        this.socket.emit('nextRound', {
            roomId: this.roomId,
            roundNumber: roundNumber,
            phase: phase,
            communityCards: communityCards
        });
    }

    // 게임 종료
    endGame(gameResult) {
        console.log('[Game Client] 게임 종료:', gameResult);
        this.socket.emit('endGame', {
            roomId: this.roomId,
            gameResult: gameResult
        });
    }

    // 게임 UI 업데이트
    updateGameUI() {
        // 게임 상태 표시
        this.updateGameInfo();
        
        // 플레이어 목록 업데이트
        this.updatePlayerList();
        
        // 커뮤니티 카드 업데이트
        this.updateCommunityCards();
        
        // 내 카드 업데이트
        this.updateMyCards();
        
        // 팟 금액 업데이트
        this.updatePot();
    }

    // 게임 정보 업데이트
    updateGameInfo() {
        const gameInfoElement = document.getElementById('gameInfo');
        if (gameInfoElement) {
            gameInfoElement.innerHTML = `
                <div class="game-info">
                    <h3>게임 정보</h3>
                    <p>라운드: ${this.gameState.currentRound}</p>
                    <p>단계: ${this.getPhaseName(this.gameState.phase)}</p>
                    <p>내 칩: ${this.gameState.myChips}</p>
                </div>
            `;
        }
    }

    // 플레이어 목록 업데이트
    updatePlayerList() {
        const playerListElement = document.getElementById('playerList');
        if (playerListElement && this.gameState.players) {
            playerListElement.innerHTML = this.gameState.players.map(player => `
                <div class="player-item ${player.username === this.username ? 'my-player' : ''}">
                    <span class="player-name">${player.username}</span>
                    <span class="player-chips">${player.chips} 칩</span>
                    ${player.lastAction ? `<span class="player-action">${this.getActionName(player.lastAction.type)} ${player.lastAction.amount}</span>` : ''}
                </div>
            `).join('');
        }
    }

    // 커뮤니티 카드 업데이트
    updateCommunityCards() {
        const communityCardsElement = document.getElementById('communityCards');
        if (communityCardsElement) {
            if (this.gameState.communityCards.length > 0) {
                communityCardsElement.innerHTML = `
                    <h4>커뮤니티 카드</h4>
                    <div class="card-container">
                        ${this.gameState.communityCards.map(card => this.renderCard(card)).join('')}
                    </div>
                `;
            } else {
                communityCardsElement.innerHTML = '<h4>커뮤니티 카드</h4><p>아직 카드가 없습니다.</p>';
            }
        }
    }

    // 내 카드 업데이트
    updateMyCards() {
        const myCardsElement = document.getElementById('myCards');
        if (myCardsElement) {
            if (this.gameState.myCards.length > 0) {
                myCardsElement.innerHTML = `
                    <h4>내 카드</h4>
                    <div class="card-container">
                        ${this.gameState.myCards.map(card => this.renderCard(card)).join('')}
                    </div>
                `;
            } else {
                myCardsElement.innerHTML = '<h4>내 카드</h4><p>카드를 받아주세요.</p>';
            }
        }
    }

    // 팟 금액 업데이트
    updatePot() {
        const potElement = document.getElementById('pot');
        if (potElement) {
            potElement.innerHTML = `
                <h4>팟</h4>
                <div class="pot-amount">${this.gameState.pot} 칩</div>
            `;
        }
    }

    // 액션 버튼 표시
    showActionButtons() {
        const actionButtonsElement = document.getElementById('actionButtons');
        if (actionButtonsElement) {
            actionButtonsElement.innerHTML = `
                <div class="action-buttons">
                    <button onclick="gameClient.sendAction('check')" class="btn btn-secondary">체크</button>
                    <button onclick="gameClient.sendAction('fold')" class="btn btn-danger">폴드</button>
                    <div class="betting-controls">
                        <input type="number" id="betAmount" placeholder="베팅 금액" min="1" max="${this.gameState.myChips}">
                        <button onclick="gameClient.sendAction('bet', parseInt(document.getElementById('betAmount').value))" class="btn btn-primary">베팅</button>
                        <button onclick="gameClient.sendAction('raise', parseInt(document.getElementById('betAmount').value))" class="btn btn-warning">레이즈</button>
                    </div>
                </div>
            `;
        }
    }

    // 카드 렌더링
    renderCard(card) {
        const suitSymbols = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
        const suitColors = { 'H': 'red', 'D': 'red', 'C': 'black', 'S': 'black' };
        
        return `
            <div class="card ${suitColors[card.suit]}" style="color: ${suitColors[card.suit]}">
                <div class="card-rank">${card.rank}</div>
                <div class="card-suit">${suitSymbols[card.suit]}</div>
            </div>
        `;
    }

    // 단계 이름 변환
    getPhaseName(phase) {
        const phaseNames = {
            'waiting_for_cards': '카드 대기',
            'preflop': '프리플랍',
            'flop': '플랍',
            'turn': '턴',
            'river': '리버',
            'showdown': '쇼다운'
        };
        return phaseNames[phase] || phase;
    }

    // 액션 이름 변환
    getActionName(actionType) {
        const actionNames = {
            'bet': '베팅',
            'call': '콜',
            'raise': '레이즈',
            'fold': '폴드',
            'check': '체크'
        };
        return actionNames[actionType] || actionType;
    }

    // 게임 결과 표시
    showGameResults(data) {
        const resultsElement = document.getElementById('gameResults');
        if (resultsElement) {
            resultsElement.innerHTML = `
                <div class="game-results">
                    <h3>게임 결과</h3>
                    <div class="final-stats">
                        <p>총 팟: ${data.finalStats.totalPot} 칩</p>
                        <h4>플레이어 순위</h4>
                        ${data.finalStats.players.map((player, index) => `
                            <div class="player-result ${index === 0 ? 'winner' : ''}">
                                <span class="rank">${index + 1}위</span>
                                <span class="name">${player.username}</span>
                                <span class="chips">${player.finalChips} 칩</span>
                                <span class="change ${player.chipsChange >= 0 ? 'positive' : 'negative'}">
                                    ${player.chipsChange >= 0 ? '+' : ''}${player.chipsChange} 칩
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    // 에러 메시지 표시
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.innerHTML = `<div class="error-message">${message}</div>`;
            setTimeout(() => {
                errorElement.innerHTML = '';
            }, 5000);
        }
    }

    // 게임 상태 초기화
    resetGame() {
        this.gameState = {
            currentRound: 1,
            phase: 'waiting',
            pot: 0,
            communityCards: [],
            players: [],
            myCards: [],
            myChips: 1000
        };
        this.updateGameUI();
    }
}

// 전역 게임 클라이언트 인스턴스
let gameClient = null;

// 게임 초기화 함수
function initializeGame(socket, roomId, username) {
    gameClient = new RealtimeGameClient(socket, roomId, username);
    console.log('[Game] 게임 클라이언트 초기화 완료');
    return gameClient;
}

// 게임 시작 함수
function startGame() {
    if (gameClient) {
        gameClient.requestCards();
    }
}

// 다음 라운드 진행 함수
function proceedToNextRound() {
    if (gameClient) {
        const currentRound = gameClient.gameState.currentRound;
        const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
        const currentPhaseIndex = phases.indexOf(gameClient.gameState.phase);
        
        if (currentPhaseIndex < phases.length - 1) {
            const nextPhase = phases[currentPhaseIndex + 1];
            let nextRound = currentRound;
            
            // 리버에서 다음 라운드로
            if (nextPhase === 'showdown' && currentRound < 4) {
                nextRound = currentRound + 1;
                nextPhase = 'preflop';
            }
            
            gameClient.nextRound(nextRound, nextPhase, []);
        }
    }
}

// 게임 종료 함수
function endGame() {
    if (gameClient) {
        const gameResult = {
            players: gameClient.gameState.players.map(player => ({
                username: player.username,
                initialChips: 1000,
                finalChips: player.chips,
                finalRank: 1 // 실제로는 족보 계산 필요
            }))
        };
        
        gameClient.endGame(gameResult);
    }
}
