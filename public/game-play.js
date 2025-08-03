if (!window.location.pathname.includes('game.html')) {
  console.warn('game-play.js: 게임 페이지가 아니므로 실행 중단');
} else {
  console.log('game-play.js loaded!');
  window.addEventListener('error', function(e) {
    console.error('전역 에러 발생:', e.message, e);
  });

  window.onload = function() {
    const socket = io();
    
    // --- DOM Elements ---
    const roomName = document.getElementById('room-name');
    const gamePhase = document.getElementById('game-phase');
    const potAmount = document.getElementById('pot-amount');
    const currentPlayer = document.getElementById('current-player');
    const gameMessage = document.getElementById('game-message');
    const communityCards = document.getElementById('community-cards');
    const playersContainer = document.getElementById('players-container');
    
    // Game Controls
    const callBtn = document.getElementById('call-btn');
    if (callBtn) {
      callBtn.addEventListener('click', () => {
        if (gameState.isMyTurn) {
          socket.emit('gameAction', {
            action: 'call',
            roomId: gameState.roomId
          });
        }
      });
    }
    const raiseBtn = document.getElementById('raise-btn');
    if (raiseBtn) {
      raiseBtn.addEventListener('click', () => {
        if (gameState.isMyTurn) {
          const amount = parseInt(betAmount.value);
          if (amount && amount >= gameState.minBet && amount <= gameState.maxBet) {
            socket.emit('gameAction', {
              action: 'raise',
              amount: amount,
              roomId: gameState.roomId
            });
          }
        }
      });
    }
    const foldBtn = document.getElementById('fold-btn');
    if (foldBtn) {
      foldBtn.addEventListener('click', () => {
        if (gameState.isMyTurn) {
          socket.emit('gameAction', {
            action: 'fold',
            roomId: gameState.roomId
          });
        }
      });
    }
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        if (gameState.isMyTurn && gameState.canCheck) {
          socket.emit('gameAction', {
            action: 'check',
            roomId: gameState.roomId
          });
        }
      });
    }
    const betBtn = document.getElementById('bet-btn');
    if (betBtn) {
      betBtn.addEventListener('click', () => {
        if (gameState.isMyTurn) {
          const amount = parseInt(betAmount.value);
          if (amount && amount >= gameState.minBet && amount <= gameState.maxBet) {
            socket.emit('gameAction', {
              action: 'bet',
              amount: amount,
              roomId: gameState.roomId
            });
          }
        }
      });
    }
    const betAmount = document.getElementById('bet-amount');
    const startGameBtn = document.getElementById('start-game-btn');
    const readyBtn = document.getElementById('ready-btn');
    const dealCardsBtn = document.getElementById('deal-cards-btn');
    const flipCardsBtn = document.getElementById('flip-cards-btn');
    const nextRoundBtn = document.getElementById('next-round-btn');
    const exitGameBtn = document.getElementById('exit-game-btn');
    if (!dealCardsBtn || !flipCardsBtn || !nextRoundBtn || !exitGameBtn) {
        console.warn('게임 컨트롤 버튼이 없는 페이지입니다. 게임 관련 JS 실행을 중단합니다.');
        return;
    }
    const exitGameBtnHeader = document.getElementById('exit-game-btn-header');
    
    // Modal
    const gameEndModal = document.getElementById('game-end-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const newGameBtn = document.getElementById('new-game-btn');
    const leaveGameBtn = document.getElementById('leave-game-btn');
    
    // Exit Confirm Modal
    const exitConfirmModal = document.getElementById('exit-confirm-modal');
    const confirmExitBtn = document.getElementById('confirm-exit-btn');
    const cancelExitBtn = document.getElementById('cancel-exit-btn');
    
    // Game State
    let myUsername = null;
    let gameState = {
        players: [],
        currentPlayer: null,
        phase: 'waiting',
        myCards: [],
        roomId: null,
        pot: 0,
        isMyTurn: false,
        canCheck: false,
        minBet: 0,
        maxBet: 0,
        communityCards: []
    };
    
    let roomState = {
        name: '',
        host: '',
        players: []
    };
    
    function updateGamePhase(phase) {
        const phaseElement = document.getElementById('game-phase');
        if (phaseElement) {
            phaseElement.textContent = phase;
        }
    }
    
    function createCardElement(card, isHidden = false) {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${isHidden ? 'face-down' : 'face-up'}`;
        
        if (!isHidden && card) {
            const isRed = card.suit === '♥' || card.suit === '♦';
            cardEl.classList.add(isRed ? 'red' : 'black');
            cardEl.textContent = `${card.rank}${card.suit}`;
        }
        
        return cardEl;
    }
    
    // --- Utility Functions ---
    function getCardDisplay(card) {
        const suits = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };
        
        const values = {
            'A': 'A',
            '2': '2',
            '3': '3',
            '4': '4',
            '5': '5',
            '6': '6',
            '7': '7',
            '8': '8',
            '9': '9',
            '10': '10',
            'J': 'J',
            'Q': 'Q',
            'K': 'K'
        };
        
        return {
            value: values[card.value] || card.value,
            suit: suits[card.suit] || card.suit,
            color: (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black'
        };
    }
    
    function updateGameDisplay() {
        // 게임 단계 업데이트
        const phaseNames = {
            'waiting': '게임 대기 중',
            'dealing': '카드 분배 중',
            'playing': '게임 진행 중',
            'flipping': '카드 뒤집기',
            'finished': '게임 종료'
        };
        gamePhase.textContent = phaseNames[gameState.phase] || gameState.phase;
        
        // 방 제목 업데이트
        if (roomState && roomState.name) {
            document.title = `소 갱 - ${roomState.name}`;
        }
        
        // 팟 금액 업데이트
        potAmount.textContent = gameState.pot || 0;
        
        // 현재 플레이어 업데이트
        if (gameState.currentPlayer) {
            currentPlayer.textContent = `${gameState.currentPlayer}의 차례`;
        } else {
            currentPlayer.textContent = '대기 중...';
        }
        
        // 커뮤니티 카드 업데이트
        communityCards.innerHTML = '';
        if (gameState.communityCards && gameState.communityCards.length > 0) {
            gameState.communityCards.forEach(card => {
                communityCards.appendChild(createCardElement(card));
            });
        }
        
        // 플레이어 목록 업데이트
        updatePlayersDisplay();
        
        // 컨트롤 버튼 상태 업데이트
        updateControls();
    }
    
    function updatePlayersDisplay() {
        console.log('updatePlayersDisplay 함수 호출됨');
        console.log('현재 게임 상태:', gameState);
        
        playersContainer.innerHTML = '';
        
        if (!gameState.players || gameState.players.length === 0) {
            return;
        }
        
        // 내 플레이어를 항상 마지막에 배치 (아래쪽)
        const sortedPlayers = [...gameState.players];
        const myIndex = sortedPlayers.findIndex(p => p.username === myUsername);
        if (myIndex !== -1) {
            const myPlayer = sortedPlayers.splice(myIndex, 1)[0];
            sortedPlayers.push(myPlayer);
        }
        
        console.log('정렬된 플레이어들:', sortedPlayers);
        
        sortedPlayers.forEach((player, index) => {
            console.log(`플레이어 ${player.username} 렌더링 중...`);
            console.log(`플레이어 ${player.username}의 카드:`, player.cards);
            
            const playerCard = document.createElement('div');
            playerCard.className = `player`;
            
            // 플레이어 상태에 따른 클래스 추가
            if (player.ready) {
                playerCard.classList.add('ready');
            }
            if (player.username === roomState.host) {
                playerCard.classList.add('host');
            }
            
            // 카드 표시
            let cardsHtml = '';
            if (player.cards && player.cards.length > 0) {
                const isMyCards = player.username === myUsername;
                const shouldShowCards = isMyCards || player.cardsRevealed;
                console.log(`플레이어 ${player.username} 카드 표시 - 내 카드: ${isMyCards}, 공개: ${shouldShowCards}`);
                console.log(`플레이어 ${player.username}의 카드 정보:`, player.cards);
                
                cardsHtml = '<div class="player-cards">';
                player.cards.forEach((card, cardIndex) => {
                    // 서버에서 받은 카드 정보를 클라이언트 형식으로 변환
                    const clientCard = {
                        suit: card.suit,
                        rank: card.rank
                    };
                    
                    const cardElement = createCardElement(clientCard, !shouldShowCards);
                    
                    // 내 카드에 클릭 이벤트 추가
                    if (isMyCards && !shouldShowCards) {
                        cardElement.addEventListener('click', () => {
                            flipCard(cardElement, clientCard);
                        });
                    }
                    
                    cardsHtml += cardElement.outerHTML;
                });
                cardsHtml += '</div>';
            } else {
                console.log(`플레이어 ${player.username}에게 카드가 없음`);
            }
            
            playerCard.innerHTML = `
                <div class="player-avatar ${player.ready ? 'ready' : ''} ${player.username === roomState.host ? 'host' : ''}"></div>
                <div class="player-name">
                    ${player.username}
                    ${player.username === roomState.host ? '<span class="host-badge">방장</span>' : ''}
                    ${player.ready ? '<span class="ready-badge">준비</span>' : ''}
                </div>
                ${cardsHtml}
                <div class="player-status">
                    ${player.ready ? '게임 준비 완료' : '게임 준비 중'}
                </div>
                <div class="player-chips">
                    칩: ${player.chips || 0}
                </div>
            `;
            
            playersContainer.appendChild(playerCard);
        });
        
        console.log('플레이어 표시 업데이트 완료');
    }
    
    function flipCard(cardElement, card) {
        // 뒤집기 애니메이션 시작
        cardElement.classList.add('flipping');
        
        // 애니메이션 중간에 카드 내용 변경
        setTimeout(() => {
            cardElement.classList.remove('face-down');
            cardElement.classList.add('face-up');
            
            const isRed = card.suit === '♥' || card.suit === '♦';
            cardElement.classList.add(isRed ? 'red' : 'black');
            cardElement.textContent = `${card.rank}${card.suit}`;
        }, 300);
        
        // 애니메이션 완료 후 클래스 제거
        setTimeout(() => {
            cardElement.classList.remove('flipping');
        }, 600);
        
        // 내 카드가 뒤집혔음을 서버에 알림
        if (myUsername) {
            socket.emit('cardRevealed', {
                roomId: gameState.roomId,
                username: myUsername
            });
        }
    }
    
    function applyPlayerLayout(playerCount) {
        // 기존 레이아웃 클래스 제거
        playersContainer.classList.remove('layout-2', 'layout-3', 'layout-4', 'layout-5', 'layout-6', 'layout-7', 'layout-8');
        
        // 플레이어 수에 따른 레이아웃 적용
        if (playerCount >= 2 && playerCount <= 8) {
            playersContainer.classList.add(`layout-${playerCount}`);
        }
    }
    
    function updateControls() {
        const isHost = roomState.host === myUsername;
        const isReady = gameState.players?.find(p => p.username === myUsername)?.ready || false;
        const gamePhase = gameState.phase;
        
        // 게임 시작 버튼 (방장만, 게임 대기 중일 때만)
        if (startGameBtn) {
            startGameBtn.style.display = (isHost && gamePhase === 'waiting') ? 'inline-block' : 'none';
        }
        
        // 준비 버튼 (게임 대기 중일 때만)
        if (readyBtn) {
            readyBtn.style.display = (gamePhase === 'waiting') ? 'inline-block' : 'none';
            readyBtn.textContent = isReady ? '준비 취소' : '준비';
        }
        
        // 카드 뒤집기 버튼 (게임 진행 중일 때)
        if (dealCardsBtn) {
            dealCardsBtn.style.display = (gamePhase === 'playing') ? 'inline-block' : 'none';
        }
        
        // 다음 라운드 버튼 (카드 뒤집기 후)
        if (nextRoundBtn) {
            nextRoundBtn.style.display = (gamePhase === 'flipping') ? 'inline-block' : 'none';
        }
    }
    
    function showGameEndModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        gameEndModal.classList.remove('d-none');
    }
    
    function hideGameEndModal() {
        gameEndModal.classList.add('d-none');
    }
    
    function showExitConfirmModal() {
        exitConfirmModal.classList.remove('d-none');
    }
    
    function hideExitConfirmModal() {
        exitConfirmModal.classList.add('d-none');
    }
    
    function updateRoomInfo() {
        const roomInfoEl = document.getElementById('room-info');
        if (roomInfoEl && roomState) {
            roomInfoEl.innerHTML = `
                방: ${roomState.name} | 
                방장: ${roomState.host} | 
                플레이어: ${roomState.players ? roomState.players.length : 0}명
            `;
        }
    }
    
    function showGameMessage(message) {
        if (gameMessage) {
            gameMessage.textContent = message;
        }
    }
    
    // --- Event Listeners ---
    newGameBtn.addEventListener('click', () => {
        hideGameEndModal();
        socket.emit('requestNewGame', { roomId: gameState.roomId });
    });
    
    leaveGameBtn.addEventListener('click', () => {
        hideGameEndModal();
        showExitConfirmModal();
    });
    
    // 카드 받기 버튼
    if (dealCardsBtn) {
        dealCardsBtn.addEventListener('click', () => {
            console.log('카드 받기 버튼 클릭됨');
            console.log('현재 게임 상태:', gameState);
            
            // URL에서 roomId 가져오기
            const urlParams = new URLSearchParams(window.location.search);
            let roomId = urlParams.get('roomId');
            
            // gameState에서도 확인
            if (!roomId && gameState?.roomId) {
                roomId = gameState.roomId;
            }
            
            // roomId가 없으면 에러 메시지 표시
            if (!roomId) {
                console.error('roomId를 찾을 수 없습니다!');
                showGameMessage('게임 상태를 확인할 수 없습니다. 페이지를 새로고침해주세요.');
                return;
            }
            
            console.log('사용할 방 ID:', roomId);
            
            // 카드 받기 애니메이션 시작
            showCardDealingAnimation();
            
            // 서버에 카드 받기 요청
            socket.emit('requestDealCards', { roomId: roomId });
            
            // 카드 받기 버튼 숨기기
            dealCardsBtn.style.display = 'none';
            
            showGameMessage('카드를 받고 있습니다...');
        });
    } else {
        console.error('dealCardsBtn을 찾을 수 없습니다!');
    }
    
    // 카드 뒤집기 버튼
    if (flipCardsBtn) {
        flipCardsBtn.addEventListener('click', () => {
            // 모든 플레이어의 카드를 보이게 하기
            gameState.players.forEach(player => {
                player.cardsRevealed = true;
            });
            updatePlayersDisplay();
            updateGamePhase('카드 공개');
            showGameMessage('모든 카드가 공개되었습니다!');
            
            // 서버에 모든 카드 뒤집기 이벤트 전송
            socket.emit('flipAllCards', { roomId: gameState.roomId });
            
            // 다음 라운드 버튼 표시
            if (nextRoundBtn) {
                nextRoundBtn.style.display = 'inline-block';
            }
            flipCardsBtn.style.display = 'none';
        });
    }
    
    // 다음 라운드 버튼
    if (nextRoundBtn) {
        nextRoundBtn.addEventListener('click', () => {
            // 새로운 라운드 시작 요청
            socket.emit('requestNewRound', { roomId: gameState.roomId });
            updateGamePhase('PRE FLIP');
            showGameMessage('새로운 라운드가 시작되었습니다!');
            
            // 버튼 상태 초기화
            dealCardsBtn.style.display = 'inline-block';
            nextRoundBtn.style.display = 'none';
        });
    }
    
    // 게임 나가기 버튼들
    if (exitGameBtn) {
        exitGameBtn.addEventListener('click', showExitConfirmModal);
    }
    
    if (exitGameBtnHeader) {
        exitGameBtnHeader.addEventListener('click', showExitConfirmModal);
    }
    
    // 게임 시작 버튼
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            socket.emit('startGame', { roomId: gameState.roomId });
        });
    }
    
    // 준비 버튼
    if (readyBtn) {
        readyBtn.addEventListener('click', () => {
            socket.emit('playerReady', { roomId: gameState.roomId });
        });
    }
    
    // 모달 확인/취소 버튼
    if (confirmExitBtn) {
        confirmExitBtn.addEventListener('click', () => {
            socket.emit('giveUpGame', { roomId: gameState.roomId });
            hideExitConfirmModal();
        });
    }
    
    if (cancelExitBtn) {
        cancelExitBtn.addEventListener('click', hideExitConfirmModal);
    }
    
    // --- Socket Event Handlers ---
    socket.on('connect', () => {
        console.log('게임 페이지에서 서버에 연결되었습니다.');
        
        // 사용자 정보 가져오기
        fetch('/api/user')
            .then(res => res.json())
            .then(data => {
                if (data.username) {
                    myUsername = data.username;
                    console.log('게임 페이지에서 내 유저명 설정:', myUsername);
                    
                    // 사용자 등록
                    socket.emit('registerUser', myUsername);
                    
                    // URL에서 방 ID 가져오기
                    const urlParams = new URLSearchParams(window.location.search);
                    const roomId = urlParams.get('roomId');
                    
                    if (roomId) {
                        gameState.roomId = roomId;
                        console.log('게임 페이지에서 방 ID 설정:', roomId);
                        
                        // 게임 중인 방에 참가 (기존 게임 상태 복원)
                        socket.emit('joinGame', { roomId: roomId });
                    } else {
                        console.error('방 ID가 없습니다.');
                        window.location.href = '/';
                    }
                } else {
                    console.log('사용자 정보를 가져올 수 없음');
                    window.location.href = '/login.html';
                }
            })
            .catch(err => {
                console.error('사용자 정보 가져오기 실패:', err);
                window.location.href = '/login.html';
            });
    });
    
    socket.on('gameStateUpdate', (data) => {
        console.log('게임 상태 업데이트:', data);
        
        gameState = { ...gameState, ...data };
        updateGameDisplay();
    });
    
    socket.on('gameMessage', (data) => {
        gameMessage.textContent = data.message;
        if (data.type === 'winner') {
            gameMessage.classList.add('winner');
        } else {
            gameMessage.classList.remove('winner');
        }
    });
    
    socket.on('gameEnd', (data) => {
        showGameEndModal(
            '게임 종료',
            `${data.winner}님이 승리했습니다! 팟: ₩${data.pot.toLocaleString()}`
        );
    });
    
    socket.on('playerLeft', (data) => {
        showGameEndModal(
            '게임 종료',
            `${data.player}님이 게임을 떠났습니다.`
        );
    });
    
    socket.on('returnToLobby', (data) => {
        console.log('returnToLobby 이벤트 받음:', data);
        console.log('대기방으로 이동합니다...');
        // 대기방으로 이동
        window.location.href = '/';
    });
    
    socket.on('error', (data) => {
        console.error('게임 오류:', data);
        gameMessage.textContent = `오류: ${data.message}`;
    });
    
    socket.on('disconnect', () => {
        console.log('게임 페이지에서 서버와 연결이 끊어졌습니다.');
    });
    
    socket.on('registerUserSuccess', () => {
        console.log('사용자 등록 성공');
    });
    
    socket.on('joinRoomSuccess', (roomState) => {
        console.log('방 참가 성공:', roomState);
        // 방에 참가한 후 카드 분배는 서버에서 처리됨
    });
    
    socket.on('roomJoined', (data) => {
        console.log('방에 입장했습니다:', data);
        roomState = data.room;
        gameState = data.gameState;
        updatePlayersDisplay();
        updateRoomInfo();
        showGameMessage('방에 입장했습니다!');
    });
    
    socket.on('playerJoined', (data) => {
        console.log('플레이어가 입장했습니다:', data);
        roomState = data.room;
        gameState = data.gameState;
        updatePlayersDisplay();
        updateRoomInfo();
        showGameMessage(`${data.player.username}님이 입장했습니다.`);
    });
    
    socket.on('playerLeft', (data) => {
        console.log('플레이어가 나갔습니다:', data);
        roomState = data.room;
        gameState = data.gameState;
        updatePlayersDisplay();
        updateRoomInfo();
        showGameMessage(`${data.player.username}님이 나갔습니다.`);
    });
    
    socket.on('playerReady', (data) => {
        console.log('플레이어가 준비했습니다:', data);
        roomState = data.room;
        gameState = data.gameState;
        updatePlayersDisplay();
        updateRoomInfo();
        showGameMessage(`${data.player.username}님이 준비했습니다.`);
    });
    
    socket.on('gameStarted', (data) => {
        console.log('게임이 시작되었습니다:', data);
        
        // 방 상태 설정
        roomState = data.room;
        gameState = data.gameState || {};
        gameState.players = data.gameState.players || roomState.players;
        
        // gameState에 roomId가 없으면 URL에서 가져와서 설정
        if (!gameState.roomId) {
            const urlParams = new URLSearchParams(window.location.search);
            const roomId = urlParams.get('roomId');
            if (roomId) {
                gameState.roomId = roomId;
                console.log('gameState에 roomId 설정:', roomId);
            } else if (roomState.id) {
                gameState.roomId = roomState.id;
                console.log('roomState에서 roomId 설정:', roomState.id);
            }
        }
        
        console.log('게임 상태 초기화 완료:', gameState);
        console.log('내 유저명:', myUsername);
        console.log('방 상태:', roomState);
        console.log('플레이어 카드 정보:', gameState.players);
        
        // 서버에서 이미 카드가 분배되었으므로 바로 표시
        updatePlayersDisplay();
        updateGameDisplay();
        updateGamePhase('카드 받기 대기');
        showGameMessage('게임이 시작되었습니다! 카드 받기 버튼을 눌러 카드를 받으세요.');
        
        // 카드 받기 버튼 표시
        if (dealCardsBtn) {
            dealCardsBtn.style.display = 'inline-block';
        }
        
        // 카드 뒤집기 버튼 숨기기
        if (flipCardsBtn) {
            flipCardsBtn.style.display = 'none';
        }
        
        updateControls();
        updateRoomInfo();
    });
    
    socket.on('gameStart', (roomState) => {
        console.log('게임 시작 이벤트 수신:', roomState);
        
        // 방 상태 설정
        roomState = roomState;
        gameState.players = roomState.players;
        gameState.roomId = roomState.id;
        
        console.log('게임 상태 설정 완료:', gameState);
        console.log('내 유저명:', myUsername);
        
        // 서버에서 이미 카드가 분배되었으므로 바로 표시
        updatePlayersDisplay();
        updateGamePhase('PRE FLIP');
        showGameMessage('소 갱 게임이 시작되었습니다! 카드를 클릭하여 뒤집으세요.');
        
        // 게임 컨트롤 표시
        if (dealCardsBtn) {
            dealCardsBtn.style.display = 'inline-block';
        }
    });
    
    socket.on('playerCardRevealed', (data) => {
        console.log('플레이어 카드 뒤집기 이벤트:', data);
        
        // 방 상태 업데이트
        roomState = data.room;
        
        // 해당 플레이어의 카드 상태 업데이트
        const player = gameState.players.find(p => p.username === data.username);
        if (player) {
            player.cardsRevealed = true;
        }
        
        // 화면 업데이트
        updatePlayersDisplay();
        showGameMessage(`${data.username}님이 카드를 뒤집었습니다!`);
    });
    
    socket.on('allCardsRevealed', (data) => {
        console.log('모든 카드 뒤집기 완료 이벤트:', data);
        
        // 방 상태 업데이트
        roomState = data.room;
        
        // 모든 플레이어의 카드를 공개 상태로 변경
        gameState.players.forEach(player => {
            player.cardsRevealed = true;
        });
        
        // 게임 단계 업데이트
        gameState.phase = 'flipping';
        
        // 화면 업데이트
        updatePlayersDisplay();
        updateGameDisplay();
        showGameMessage('모든 카드가 공개되었습니다!');
        
        // 다음 라운드 버튼 표시
        if (nextRoundBtn) {
            nextRoundBtn.style.display = 'inline-block';
        }
        if (dealCardsBtn) {
            dealCardsBtn.style.display = 'none';
        }
        if (flipCardsBtn) {
            flipCardsBtn.style.display = 'none';
        }
    });
    
    socket.on('cardsDealt', (data) => {
        console.log('cardsDealt 이벤트 받음:', data);
        
        // 방 상태 업데이트
        roomState = data.room;
        gameState = data.gameState;
        
        // gameState에 roomId가 없으면 URL에서 가져와서 설정
        if (!gameState.roomId) {
            const urlParams = new URLSearchParams(window.location.search);
            const roomId = urlParams.get('roomId');
            if (roomId) {
                gameState.roomId = roomId;
                console.log('gameState에 roomId 설정:', roomId);
            }
        }
        
        console.log('업데이트된 방 상태:', roomState);
        console.log('업데이트된 게임 상태:', gameState);
        
        // 화면 업데이트
        updatePlayersDisplay();
        updateGameDisplay();
        updateGamePhase('카드 분배 완료');
        showGameMessage('카드가 분배되었습니다! 카드를 클릭하여 뒤집으세요.');
        
        // 카드 뒤집기 버튼 표시
        if (flipCardsBtn) {
            flipCardsBtn.style.display = 'inline-block';
        }
        
        console.log('cardsDealt 이벤트 처리 완료');
    });
    
    socket.on('roomStateUpdate', (roomState) => {
        console.log('방 상태 업데이트:', roomState);
        
        // 방 상태 업데이트
        roomState = roomState;
        
        // 게임이 시작되지 않은 상태라면 대기방 상태로 표시
        if (roomState.state === 'waiting') {
            gameState.phase = 'waiting';
            gameState.players = roomState.players;
            updatePlayersDisplay();
            updateGameDisplay();
            updateControls();
            updateRoomInfo();
        }
    });
    
    // --- Initialize ---
    // 사용자 정보 가져오기
    fetch('/api/user')
        .then(res => res.json())
        .then(data => {
            if (data.username) {
                myUsername = data.username;
                console.log('초기화 시 내 유저명 설정:', myUsername);
            } else {
                window.location.href = '/login.html';
            }
        })
        .catch(err => {
            console.error('사용자 정보 가져오기 실패:', err);
            window.location.href = '/login.html';
        });
        
    // 카드 받기 애니메이션 함수 (간단한 위에서 내려오는 효과)
    function showCardDealingAnimation() {
        // 기존 애니메이션 요소 제거
        const existingAnimation = document.querySelector('.card-dealing-animation');
        if (existingAnimation) {
            existingAnimation.remove();
        }
        
        // 애니메이션 컨테이너 생성
        const animationContainer = document.createElement('div');
        animationContainer.className = 'card-dealing-animation';
        animationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            display: flex;
            gap: 10px;
        `;
        
        // 카드 두 장 생성
        for (let i = 0; i < 2; i++) {
            const card = document.createElement('div');
            card.className = 'dealing-card';
            card.style.cssText = `
                width: 60px;
                height: 90px;
                background: linear-gradient(45deg, #2c3e50, #34495e);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                transform: translateY(-100px);
                opacity: 0;
                transition: all 0.6s ease-out;
                border: 2px solid #fff;
            `;
            
            // 카드 뒷면 패턴 추가
            card.innerHTML = `
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 24px;
                    color: #fff;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                ">♠</div>
            `;
            
            animationContainer.appendChild(card);
        }
        
        document.body.appendChild(animationContainer);
        
        // 애니메이션 실행
        setTimeout(() => {
            const cards = animationContainer.querySelectorAll('.dealing-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.style.transform = 'translateY(0)';
                    card.style.opacity = '1';
                }, index * 200);
            });
        }, 100);
        
        // 애니메이션 완료 후 제거
        setTimeout(() => {
            if (animationContainer.parentNode) {
                animationContainer.remove();
            }
        }, 3000);
    }
    }
  };
} 