document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const currentUsernameSpan = document.getElementById('currentUsername');
    const onlineUsersList = document.getElementById('online-users');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Views
    const lobbyView = document.getElementById('lobby-view');
    const roomView = document.getElementById('room-view');
    const waitingRoomView = document.getElementById('waiting-room-view');
    const gameInProgressView = document.getElementById('game-in-progress-view');

    // Lobby Elements
    const roomListDiv = document.getElementById('room-list');
    const createRoomBtn = document.getElementById('create-room-btn');
    const roomNameInput = document.getElementById('roomNameInput');
    
    // Room Elements
    const roomTitle = document.getElementById('room-title');
    const playerList = document.getElementById('player-list');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const readyBtn = document.getElementById('ready-btn');
    const giveUpBtn = document.getElementById('give-up-btn');
    const gameInfoDiv = document.getElementById('game-info');
    const startGameBtn = document.getElementById('start-game-btn');

    let currentRoomState = null;
    let myUsername = null;

    // --- SPA 뷰 전환 함수 ---
    function showLobby() {
        lobbyView.classList.remove('d-none');
        roomView.classList.add('d-none');
        waitingRoomView.classList.remove('d-none');
        gameInProgressView.classList.add('d-none');
        currentRoomState = null;
    }
    function showRoom(roomState) {
        console.log('showRoom 호출됨:', roomState);
        console.log('현재 뷰 상태 - lobbyView:', lobbyView.classList.contains('d-none'), 'roomView:', roomView.classList.contains('d-none'));
        
        lobbyView.classList.add('d-none');
        roomView.classList.remove('d-none');
        waitingRoomView.classList.remove('d-none');
        gameInProgressView.classList.add('d-none');
        
        console.log('뷰 전환 후 - lobbyView:', lobbyView.classList.contains('d-none'), 'roomView:', roomView.classList.contains('d-none'));
        
        updateRoomView(roomState);
    }
    // showGame 함수 제거 - 게임 시작 시 game.html 페이지로 이동

    const updateRoomView = (roomState) => {
        console.log('updateRoomView 호출됨:', roomState);
        currentRoomState = roomState;
        if (!currentRoomState) return;
        
        roomTitle.textContent = roomState.name;
        
        // 방 상태 정보 업데이트
        const roomStatus = document.getElementById('room-status');
        const playerCount = document.getElementById('player-count');
        
        if (roomStatus) {
            roomStatus.textContent = roomState.state === 'waiting' ? '대기 중' : '게임 중';
        }
        
        if (playerCount) {
            playerCount.textContent = `${roomState.players.length}/2`;
        }
        
        // 플레이어 목록 업데이트
        playerList.innerHTML = '';
        roomState.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            // 플레이어 상태에 따른 클래스 추가
            if (player.ready) {
                playerCard.classList.add('ready');
            }
            if (player.username === roomState.host) {
                playerCard.classList.add('host');
            }
            
            playerCard.innerHTML = `
                <div class="player-header">
                    <div class="player-name">
                        ${player.username}
                        ${player.username === roomState.host ? '<span class="host-badge">방장</span>' : ''}
                    </div>
                    <span class="${player.ready ? 'ready-badge' : 'not-ready-badge'}">
                        ${player.ready ? '준비 완료' : '준비 안됨'}
                    </span>
                </div>
                <div class="player-status">
                    <div class="status-icon ${player.ready ? 'ready' : 'not-ready'}"></div>
                    <span>${player.ready ? '게임 준비 완료' : '게임 준비 중'}</span>
                </div>
            `;
            
            playerList.appendChild(playerCard);
        });
        
        // 준비 버튼 텍스트
        const myPlayer = roomState.players.find(p => p.username === myUsername);
        if (myPlayer) {
            readyBtn.textContent = myPlayer.ready ? '준비 취소' : '준비';
            readyBtn.classList.toggle('btn-warning', myPlayer.ready);
            readyBtn.classList.toggle('btn-success', !myPlayer.ready);
        }
        
        // 게임 시작 버튼 노출 및 활성화 조건 (디버깅용 로그 추가)
        console.log('myUsername:', myUsername, 'roomState.host:', roomState.host, 'isHost:', isHost(), 'allReady:', allReady(), 'state:', roomState.state);
        if (isHost() && roomState.state === 'waiting') {
            startGameBtn.classList.remove('d-none');
            const canStart = allReady();
            startGameBtn.disabled = !canStart;
            
            // 버튼 텍스트 업데이트
            if (roomState.players.length < 2) {
                startGameBtn.textContent = `최소 2명 필요 (현재 ${roomState.players.length}명)`;
            } else if (!canStart) {
                startGameBtn.textContent = '모든 플레이어가 준비되어야 합니다';
            } else {
                startGameBtn.textContent = '게임 시작';
            }
        } else {
            startGameBtn.classList.add('d-none');
            startGameBtn.disabled = true;
        }
        
        // 게임 상태에 따라 뷰 전환
        console.log('게임 상태에 따른 뷰 전환 - roomState.state:', roomState.state);
        if (roomState.state === 'playing') {
            // 게임이 시작되면 game.html 페이지로 이동
            console.log('게임 진행 중 - game.html 페이지로 이동');
            if (roomState.id) {
                window.location.href = `/game.html?roomId=${roomState.id}`;
            }
        } else {
            waitingRoomView.classList.remove('d-none');
            gameInProgressView.classList.add('d-none');
            console.log('대기방 뷰로 전환');
        }
    };

    // --- Event Listeners ---
    logoutBtn.addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' })
            .then(res => res.json())
            .then(data => { if (data.success) window.location.href = '/login.html'; });
    });

    // 방 만들기 버튼을 처음엔 비활성화
    createRoomBtn.disabled = true;
    let canCreateRoom = false;

    createRoomBtn.addEventListener('click', () => {
        if (!canCreateRoom) return;
        let roomName = roomNameInput.value.trim();
        if (!roomName) {
            roomName = '방' + Math.floor(1000 + Math.random() * 9000);
        }
        socket.emit('createRoom', { roomName });
        roomNameInput.value = '';
    });

    leaveRoomBtn.addEventListener('click', () => {
        socket.emit('leaveRoom');
    });

    readyBtn.addEventListener('click', () => {
        socket.emit('toggleReady');
    });

    giveUpBtn.addEventListener('click', () => {
        if (currentRoomState && confirm('정말로 게임을 포기하시겠습니까?')) {
            socket.emit('giveUpGame', { roomId: currentRoomState.id });
        }
    });

    startGameBtn.addEventListener('click', () => {
        if (currentRoomState && isHost() && allReady()) {
            socket.emit('startRoomGame', { roomId: currentRoomState.id });
        }
    });

    // --- Socket Event Handlers ---
    socket.on('connect', () => {
        console.log('서버에 연결되었습니다.');
        fetch('/api/user').then(res => res.json()).then(data => {
            if (data.username) {
                myUsername = data.username;
                currentUsernameSpan.textContent = data.username;
                socket.emit('registerUser', data.username);
            } else {
                window.location.href = '/login.html';
            }
        });
    });

    socket.on('onlineUsers', (users) => {
        onlineUsersList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = user;
            onlineUsersList.appendChild(li);
        });
    });

    socket.on('roomListUpdate', (rooms) => {
        roomListDiv.innerHTML = '';
        if (rooms.length === 0) {
            roomListDiv.textContent = '현재 생성된 방이 없습니다.';
            return;
        }
        rooms.forEach(room => {
            const roomEl = document.createElement('div');
            roomEl.className = 'room-item list-group-item d-flex justify-content-between align-items-center';
            roomEl.innerHTML = `
                <span>${room.name} (${room.playerCount}/${room.maxPlayers})</span>
                <span class="badge ${room.state === 'playing' ? 'bg-danger' : 'bg-success'}">${room.state}</span>
            `;
            if (room.state === 'waiting') {
                const joinBtn = document.createElement('button');
                joinBtn.textContent = '참가';
                joinBtn.className = 'btn btn-sm btn-primary';
                joinBtn.onclick = () => socket.emit('joinRoom', { roomId: room.id });
                roomEl.appendChild(joinBtn);
            }
            roomListDiv.appendChild(roomEl);
        });
    });

    socket.on('joinRoomSuccess', (roomState) => {
        showRoom(roomState);
    });

    socket.on('roomCreated', (data) => {
        console.log('방이 생성되었습니다:', data);
        console.log('data.room:', data.room);
        // 방장이 방을 만들면 자동으로 대기방으로 이동
        if (data.room) {
            console.log('showRoom 호출 전');
            showRoom(data.room);
            console.log('showRoom 호출 후');
        } else {
            console.error('data.room이 없습니다:', data);
        }
    });

    socket.on('roomStateUpdate', (roomState) => {
        console.log('roomStateUpdate 이벤트 수신:', roomState);
        if (!myUsername) {
            fetch('/api/user').then(res => res.json()).then(data => {
                if (data.username) {
                    myUsername = data.username;
                    updateRoomView(roomState);
                }
            });
        } else {
            updateRoomView(roomState);
        }
        console.log('roomState:', roomState, 'myUsername:', myUsername);
        
        // 게임 상태가 playing이면 game.html 페이지로 이동
        if (roomState.state === 'playing') {
            console.log('게임 상태가 playing으로 변경됨, game.html 페이지로 이동');
            if (roomState.id) {
                window.location.href = `/game.html?roomId=${roomState.id}`;
            }
        }
    });

    socket.on('gameStart', (roomState) => {
        console.log('게임 시작:', roomState);
        // 게임 페이지로 이동
        window.location.href = `/game.html?roomId=${roomState.id}`;
    });

    socket.on('gameStarted', (data) => {
        console.log('게임이 시작되었습니다:', data);
        
        // 게임이 시작되면 game.html 페이지로 이동
        if (currentRoomState && currentRoomState.id) {
            console.log('게임 시작됨 - game.html 페이지로 이동');
            window.location.href = `/game.html?roomId=${currentRoomState.id}`;
        }
    });

    socket.on('redirectToGame', (data) => {
        console.log('게임 페이지로 이동:', data);
        
        // 게임 페이지로 이동
        if (data.roomId) {
            window.location.href = `/game.html?roomId=${data.roomId}`;
        }
    });

    socket.on('leftRoomSuccess', () => {
        showLobby();
    });

    socket.on('gameEndedByGiveUp', ({ reason }) => {
        alert(reason);
        showLobby();
    });

    socket.on('lobbyError', ({ message }) => {
        alert(`오류: ${message}`);
    });

    // 서버에서 registerUser 처리 후 신호를 받으면 방 만들기 버튼 활성화
    socket.on('registerUserSuccess', () => {
        canCreateRoom = true;
        createRoomBtn.disabled = false;
    });

    // 새로운 게임 시스템 이벤트 핸들러들
    socket.on('newGameStarted', (data) => {
        console.log('새로운 게임 시스템 시작:', data);
        showMessage(data.message);
        
        // 게임 단계 표시 업데이트
        updateGamePhase(data.currentPhase);
    });

    socket.on('gameStateUpdate', (gameState) => {
        console.log('게임 상태 업데이트:', gameState);
        updateGamePhase(gameState.currentPhase);
    });

    socket.on('dealCards', (data) => {
        console.log('카드 분배:', data);
        showMessage('카드가 분배되었습니다!');
        
        // 개인 패 표시
        displayPlayerHand(data.hand);
        
        // 커뮤니티 카드 표시 (플랍)
        displayCommunityCards(data.communityCards);
    });

    socket.on('turnCard', (card) => {
        console.log('턴 카드:', card);
        showMessage('턴 카드가 공개되었습니다!');
        addCommunityCard(card);
    });

    socket.on('riverCard', (card) => {
        console.log('리버 카드:', card);
        showMessage('리버 카드가 공개되었습니다!');
        addCommunityCard(card);
    });

    socket.on('allCardsRevealed', (data) => {
        console.log('모든 카드 공개:', data);
        showMessage('모든 커뮤니티 카드가 공개되었습니다! 순위를 예측해주세요.');
        
        // 순위 예측 UI 표시
        showRankPredictionUI();
    });

    socket.on('predictionPhase', (data) => {
        console.log('예측 단계 시작:', data);
        showMessage(`순위 예측 시간: ${data.timeLimit / 1000}초`);
        
        // 예측 타이머 시작
        startPredictionTimer(data.deadline);
    });

    socket.on('playerPredicted', (data) => {
        console.log('플레이어 예측 완료:', data);
        showMessage(data.message);
    });

    socket.on('roundResult', (data) => {
        console.log('라운드 결과:', data);
        
        if (data.isSuccess) {
            showMessage(`🎉 라운드 성공! (${data.successCount}/3)`);
        } else {
            showMessage(`❌ 라운드 실패! (${data.failureCount}/3)`);
        }
        
        // 결과 표시
        displayRoundResult(data);
    });

    socket.on('nextRound', (data) => {
        console.log('다음 라운드:', data);
        showMessage(data.message);
        
        // 새 라운드 준비
        prepareNextRound();
    });

    socket.on('gameOver', (data) => {
        console.log('게임 종료:', data);
        
        if (data.result === 'WIN') {
            showMessage(`🏆 게임 승리! ${data.message}`);
        } else {
            showMessage(`💔 게임 패배! ${data.message}`);
        }
        
        // 게임 종료 UI 표시
        showGameOverUI(data);
    });

    // --- Init ---
    showLobby();

    function isHost() {
        return currentRoomState && myUsername && currentRoomState.host === myUsername;
    }
    function allReady() {
        return currentRoomState && 
               currentRoomState.players.length >= 2 && 
               currentRoomState.players.every(p => p.ready);
    }

    // 새로운 게임 시스템 UI 함수들
    function updateGamePhase(phase) {
        const gamePhaseEl = document.getElementById('game-phase');
        if (gamePhaseEl) {
            gamePhaseEl.textContent = phase;
        }
    }

    function showMessage(message) {
        const gameMessageEl = document.getElementById('game-message');
        if (gameMessageEl) {
            gameMessageEl.textContent = message;
        }
    }

    function displayPlayerHand(hand) {
        const playersContainer = document.getElementById('players-container');
        if (!playersContainer) return;
        
        // 개인 패 표시 로직
        const handDisplay = document.createElement('div');
        handDisplay.className = 'player-hand';
        handDisplay.innerHTML = `
            <h4>내 패:</h4>
            <div class="cards">
                ${hand.map(card => `<div class="card">${card.rank}${card.suit}</div>`).join('')}
            </div>
        `;
        
        playersContainer.appendChild(handDisplay);
    }

    function displayCommunityCards(cards) {
        const playersContainer = document.getElementById('players-container');
        if (!playersContainer) return;
        
        const communityDisplay = document.createElement('div');
        communityDisplay.className = 'community-cards';
        communityDisplay.innerHTML = `
            <h4>커뮤니티 카드:</h4>
            <div class="cards">
                ${cards.map(card => `<div class="card">${card.rank}${card.suit}</div>`).join('')}
            </div>
        `;
        
        playersContainer.appendChild(communityDisplay);
    }

    function addCommunityCard(card) {
        const communityDisplay = document.querySelector('.community-cards .cards');
        if (communityDisplay) {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.textContent = `${card.rank}${card.suit}`;
            communityDisplay.appendChild(cardEl);
        }
    }

    function showRankPredictionUI() {
        const gameControls = document.querySelector('.game-controls');
        if (!gameControls) return;
        
        const predictionUI = document.createElement('div');
        predictionUI.className = 'rank-prediction';
        predictionUI.innerHTML = `
            <h4>순위 예측</h4>
            <select id="rank-prediction-select">
                <option value="">순위 선택</option>
                <option value="1">1위</option>
                <option value="2">2위</option>
                <option value="3">3위</option>
            </select>
            <button id="submit-prediction-btn" class="btn btn-primary">예측 제출</button>
        `;
        
        gameControls.appendChild(predictionUI);
        
        // 예측 제출 이벤트 리스너
        const submitBtn = document.getElementById('submit-prediction-btn');
        const rankSelect = document.getElementById('rank-prediction-select');
        
        submitBtn.addEventListener('click', () => {
            const predictedRank = rankSelect.value;
            if (predictedRank && currentRoomState) {
                socket.emit('predictRank', { 
                    roomId: currentRoomState.id, 
                    predictedRank: parseInt(predictedRank) 
                });
                
                // UI 비활성화
                submitBtn.disabled = true;
                rankSelect.disabled = true;
                showMessage('순위 예측을 제출했습니다!');
            }
        });
    }

    function startPredictionTimer(deadline) {
        const timeLeft = deadline - Date.now();
        if (timeLeft <= 0) return;
        
        const timerEl = document.createElement('div');
        timerEl.id = 'prediction-timer';
        timerEl.className = 'timer';
        timerEl.textContent = `남은 시간: ${Math.ceil(timeLeft / 1000)}초`;
        
        const gameControls = document.querySelector('.game-controls');
        if (gameControls) {
            gameControls.appendChild(timerEl);
        }
        
        const timer = setInterval(() => {
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                timerEl.textContent = '시간 종료!';
                clearInterval(timer);
            } else {
                timerEl.textContent = `남은 시간: ${Math.ceil(remaining / 1000)}초`;
            }
        }, 1000);
    }

    function displayRoundResult(data) {
        const playersContainer = document.getElementById('players-container');
        if (!playersContainer) return;
        
        const resultDisplay = document.createElement('div');
        resultDisplay.className = 'round-result';
        resultDisplay.innerHTML = `
            <h4>라운드 결과</h4>
            <div class="result-summary">
                <p>결과: ${data.isSuccess ? '성공' : '실패'}</p>
                <p>성공: ${data.successCount}/3, 실패: ${data.failureCount}/3</p>
            </div>
            <div class="player-results">
                ${data.players.map(player => `
                    <div class="player-result">
                        <strong>${player.username}</strong>: 
                        예측 ${player.predictedRank}위, 
                        실제 ${player.actualRank.rank}위 (${player.actualRank.name})
                    </div>
                `).join('')}
            </div>
        `;
        
        playersContainer.appendChild(resultDisplay);
    }

    function prepareNextRound() {
        // 다음 라운드 준비 UI
        const gameControls = document.querySelector('.game-controls');
        if (!gameControls) return;
        
        const nextRoundBtn = document.createElement('button');
        nextRoundBtn.className = 'btn btn-success btn-lg';
        nextRoundBtn.textContent = '다음 라운드 시작';
        nextRoundBtn.addEventListener('click', () => {
            if (currentRoomState) {
                socket.emit('startNewGameSystem', { roomId: currentRoomState.id });
            }
        });
        
        gameControls.appendChild(nextRoundBtn);
    }

    function showGameOverUI(data) {
        const gameControls = document.querySelector('.game-controls');
        if (!gameControls) return;
        
        const gameOverDisplay = document.createElement('div');
        gameOverDisplay.className = 'game-over';
        gameOverDisplay.innerHTML = `
            <h3>게임 종료</h3>
            <p>${data.message}</p>
            <p>최종 결과: 성공 ${data.successCount}회, 실패 ${data.failureCount}회</p>
            <button id="back-to-lobby-btn" class="btn btn-primary">로비로 돌아가기</button>
        `;
        
        gameControls.appendChild(gameOverDisplay);
        
        const backBtn = document.getElementById('back-to-lobby-btn');
        backBtn.addEventListener('click', () => {
            showLobby();
        });
    }
}); 