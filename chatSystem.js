// 채팅 시스템 (게임 내, 로비, 개인 메시지)
const db = require('./database');
const { v4: uuidv4 } = require('uuid');

class ChatSystemManager {
    constructor() {
        this.chatRooms = new Map(); // roomId -> chat history
        this.privateChats = new Map(); // userId -> Map(friendId -> messages)
        this.bannedWords = new Set(['욕설1', '욕설2']); // 금지어 목록
        this.rateLimiter = new Map(); // userId -> {count, lastReset}
    }

    // 메시지 유형별 필터링
    filterMessage(message, context = 'general') {
        let filtered = message.trim();
        
        // The Gang 게임 규칙 적용
        if (context === 'game') {
            // 직접적인 카드 정보 공유 금지
            const forbiddenPatterns = [
                /내 카드는|my card|카드가|카드는/gi,
                /에이스|킹|퀸|잭|ace|king|queen|jack/gi,
                /스페이드|하트|다이아몬드|클럽|spade|heart|diamond|club/gi,
                /페어|트리플|플러시|스트레이트|pair|triple|flush|straight/gi
            ];
            
            for (const pattern of forbiddenPatterns) {
                if (pattern.test(filtered)) {
                    return {
                        allowed: false,
                        filtered: '[게임 규칙 위반: 직접적인 카드 정보 공유 금지]',
                        reason: 'card_info_violation'
                    };
                }
            }
        }
        
        // 금지어 필터링
        for (const word of this.bannedWords) {
            const regex = new RegExp(word, 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        }
        
        // 길이 제한
        if (filtered.length > 200) {
            filtered = filtered.substring(0, 200) + '...';
        }
        
        return {
            allowed: true,
            filtered: filtered,
            reason: null
        };
    }

    // 스팸 방지를 위한 레이트 리미터
    checkRateLimit(userId, limit = 10, windowMs = 60000) {
        const now = Date.now();
        const userLimit = this.rateLimiter.get(userId);
        
        if (!userLimit) {
            this.rateLimiter.set(userId, { count: 1, lastReset: now });
            return true;
        }
        
        // 시간 윈도우 리셋
        if (now - userLimit.lastReset > windowMs) {
            userLimit.count = 1;
            userLimit.lastReset = now;
            return true;
        }
        
        // 제한 확인
        if (userLimit.count >= limit) {
            return false;
        }
        
        userLimit.count++;
        return true;
    }

    // 게임 룸 채팅 메시지 처리
    async processGameChatMessage(roomId, username, message, messageType = 'text') {
        try {
            // 레이트 리미터 확인
            if (!this.checkRateLimit(username)) {
                return {
                    success: false,
                    message: '메시지를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해주세요.'
                };
            }

            // 메시지 필터링
            const filterResult = this.filterMessage(message, 'game');
            if (!filterResult.allowed) {
                return {
                    success: false,
                    message: filterResult.reason === 'card_info_violation' 
                        ? 'The Gang 게임에서는 직접적인 카드 정보를 공유할 수 없습니다.'
                        : '부적절한 내용이 포함된 메시지입니다.'
                };
            }

            const chatMessage = {
                id: uuidv4(),
                roomId: roomId,
                username: username,
                message: filterResult.filtered,
                type: messageType,
                timestamp: new Date(),
                gameContext: true
            };

            // 게임 룸 채팅 히스토리에 추가
            if (!this.chatRooms.has(roomId)) {
                this.chatRooms.set(roomId, []);
            }
            const roomChat = this.chatRooms.get(roomId);
            roomChat.push(chatMessage);

            // 최근 50개 메시지만 유지
            if (roomChat.length > 50) {
                roomChat.shift();
            }

            // 데이터베이스에 저장
            await db.saveChatMessage(chatMessage);

            console.log(`[Game Chat] ${username}: ${filterResult.filtered} (방: ${roomId})`);
            return { success: true, chatMessage: chatMessage };

        } catch (error) {
            console.error('[Game Chat] 채팅 메시지 처리 실패:', error);
            return { success: false, message: '메시지 전송 중 오류가 발생했습니다.' };
        }
    }

    // 로비 채팅 메시지 처리
    async processLobbyMessage(username, message) {
        try {
            if (!this.checkRateLimit(username, 5, 30000)) { // 로비는 더 엄격한 제한
                return {
                    success: false,
                    message: '메시지를 너무 자주 보내고 있습니다.'
                };
            }

            const filterResult = this.filterMessage(message, 'lobby');
            if (!filterResult.allowed) {
                return {
                    success: false,
                    message: '부적절한 내용이 포함된 메시지입니다.'
                };
            }

            const chatMessage = {
                id: uuidv4(),
                roomId: 'lobby',
                username: username,
                message: filterResult.filtered,
                type: 'text',
                timestamp: new Date(),
                gameContext: false
            };

            // 로비 채팅 히스토리에 추가
            if (!this.chatRooms.has('lobby')) {
                this.chatRooms.set('lobby', []);
            }
            const lobbyChat = this.chatRooms.get('lobby');
            lobbyChat.push(chatMessage);

            // 최근 100개 메시지만 유지
            if (lobbyChat.length > 100) {
                lobbyChat.shift();
            }

            await db.saveChatMessage(chatMessage);
            return { success: true, chatMessage: chatMessage };

        } catch (error) {
            console.error('[Lobby Chat] 로비 채팅 처리 실패:', error);
            return { success: false, message: '메시지 전송 중 오류가 발생했습니다.' };
        }
    }

    // 개인 메시지 처리
    async processPrivateMessage(fromUsername, toUsername, message) {
        try {
            // 차단 관계 확인
            const isBlocked = await db.isUserBlocked(toUsername, fromUsername);
            if (isBlocked) {
                return {
                    success: false,
                    message: '해당 사용자에게 메시지를 보낼 수 없습니다.'
                };
            }

            if (!this.checkRateLimit(fromUsername, 20, 60000)) {
                return {
                    success: false,
                    message: '메시지를 너무 자주 보내고 있습니다.'
                };
            }

            const filterResult = this.filterMessage(message, 'private');
            if (!filterResult.allowed) {
                return {
                    success: false,
                    message: '부적절한 내용이 포함된 메시지입니다.'
                };
            }

            const privateMessage = {
                id: uuidv4(),
                from: fromUsername,
                to: toUsername,
                message: filterResult.filtered,
                timestamp: new Date(),
                read: false
            };

            // 개인 채팅 히스토리에 추가
            const chatKey = [fromUsername, toUsername].sort().join('_');
            if (!this.privateChats.has(chatKey)) {
                this.privateChats.set(chatKey, []);
            }
            const chatHistory = this.privateChats.get(chatKey);
            chatHistory.push(privateMessage);

            // 최근 500개 메시지만 유지
            if (chatHistory.length > 500) {
                chatHistory.shift();
            }

            await db.savePrivateMessage(privateMessage);
            return { success: true, privateMessage: privateMessage };

        } catch (error) {
            console.error('[Private Message] 개인 메시지 처리 실패:', error);
            return { success: false, message: '메시지 전송 중 오류가 발생했습니다.' };
        }
    }

    // 채팅 히스토리 조회
    getChatHistory(roomId, limit = 50) {
        const chatHistory = this.chatRooms.get(roomId) || [];
        return chatHistory.slice(-limit);
    }

    // 개인 메시지 히스토리 조회
    getPrivateChatHistory(user1, user2, limit = 50) {
        const chatKey = [user1, user2].sort().join('_');
        const chatHistory = this.privateChats.get(chatKey) || [];
        return chatHistory.slice(-limit);
    }

    // 읽지 않은 메시지 수 조회
    async getUnreadMessageCount(username) {
        try {
            return await db.getUnreadMessageCount(username);
        } catch (error) {
            console.error('[Unread Count] 읽지 않은 메시지 수 조회 실패:', error);
            return 0;
        }
    }

    // 메시지 읽음 표시
    async markMessagesAsRead(username, fromUsername) {
        try {
            await db.markMessagesAsRead(username, fromUsername);
            
            // 메모리에서도 업데이트
            const chatKey = [username, fromUsername].sort().join('_');
            const chatHistory = this.privateChats.get(chatKey);
            if (chatHistory) {
                chatHistory.forEach(msg => {
                    if (msg.to === username && msg.from === fromUsername) {
                        msg.read = true;
                    }
                });
            }
            
            return true;
        } catch (error) {
            console.error('[Mark Read] 메시지 읽음 처리 실패:', error);
            return false;
        }
    }

    // 게임 내 허용된 소통 메시지들 (템플릿)
    getGameCommunicationTemplates() {
        return {
            confidence: [
                '내 핸드는 강합니다',
                '내 핸드는 약합니다',
                '내 핸드는 보통입니다'
            ],
            actions: [
                '패스하겠습니다',
                '칩을 선택했습니다',
                '고민 중입니다'
            ],
            emotions: [
                '좋습니다!',
                '아쉽네요',
                '잘했습니다',
                '화이팅!'
            ],
            strategy: [
                '조심스럽게 가요',
                '더 적극적으로 가요',
                '잘 맞춰봅시다'
            ]
        };
    }

    // 시스템 메시지 생성
    createSystemMessage(roomId, message, type = 'info') {
        const systemMessage = {
            id: uuidv4(),
            roomId: roomId,
            username: 'SYSTEM',
            message: message,
            type: type,
            timestamp: new Date(),
            isSystem: true
        };

        if (!this.chatRooms.has(roomId)) {
            this.chatRooms.set(roomId, []);
        }
        this.chatRooms.get(roomId).push(systemMessage);

        return systemMessage;
    }

    // 게임 이벤트 메시지 생성
    createGameEventMessage(roomId, eventType, data) {
        let message = '';
        
        switch (eventType) {
            case 'player_joined':
                message = `${data.username}님이 게임에 참가했습니다.`;
                break;
            case 'player_left':
                message = `${data.username}님이 게임을 떠났습니다.`;
                break;
            case 'game_started':
                message = `게임이 시작되었습니다! (모드: ${data.gameMode})`;
                break;
            case 'round_started':
                message = `${data.round}라운드가 시작되었습니다.`;
                break;
            case 'chip_taken':
                message = `${data.player}님이 칩을 가져갔습니다.`;
                break;
            case 'showdown':
                message = `쇼다운! ${data.success ? '하이스트 성공!' : '하이스트 실패!'}`;
                break;
            case 'game_ended':
                message = `게임이 종료되었습니다. ${data.victory ? '승리!' : '패배!'}`;
                break;
        }

        return this.createSystemMessage(roomId, message, 'game_event');
    }

    // 채팅 기록 정리 (오래된 메시지 삭제)
    async cleanupOldMessages(daysToKeep = 30) {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            
            // 데이터베이스에서 오래된 메시지 삭제
            await db.deleteOldChatMessages(cutoffDate);
            
            // 메모리에서도 정리
            this.chatRooms.forEach((messages, roomId) => {
                const filtered = messages.filter(msg => msg.timestamp > cutoffDate);
                this.chatRooms.set(roomId, filtered);
            });

            this.privateChats.forEach((messages, chatKey) => {
                const filtered = messages.filter(msg => msg.timestamp > cutoffDate);
                this.privateChats.set(chatKey, filtered);
            });

            console.log(`[Chat Cleanup] ${daysToKeep}일 이전 메시지 정리 완료`);
        } catch (error) {
            console.error('[Chat Cleanup] 채팅 기록 정리 실패:', error);
        }
    }

    // 사용자 채팅 차단 (관리자용)
    async muteUser(username, mutedBy, duration = 3600000) { // 기본 1시간
        try {
            const muteExpires = new Date(Date.now() + duration);
            await db.muteUser(username, mutedBy, muteExpires);
            
            console.log(`[Chat Mute] ${username} 채팅 차단 ${duration/60000}분 (by ${mutedBy})`);
            return true;
        } catch (error) {
            console.error('[Chat Mute] 채팅 차단 실패:', error);
            return false;
        }
    }

    // 채팅 차단 해제
    async unmuteUser(username) {
        try {
            await db.unmuteUser(username);
            console.log(`[Chat Unmute] ${username} 채팅 차단 해제`);
            return true;
        } catch (error) {
            console.error('[Chat Unmute] 채팅 차단 해제 실패:', error);
            return false;
        }
    }

    // 사용자 채팅 차단 상태 확인
    async isUserMuted(username) {
        try {
            return await db.isUserMuted(username);
        } catch (error) {
            console.error('[Mute Check] 차단 상태 확인 실패:', error);
            return false;
        }
    }
}

module.exports = ChatSystemManager;