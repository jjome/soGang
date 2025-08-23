// 게임 리플레이 시스템
const db = require('./database');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ReplaySystemManager {
    constructor() {
        this.replayDir = path.join(__dirname, 'replays');
        this.activeRecordings = new Map(); // roomId -> recording data
        this.ensureReplayDirectory();
    }

    // 리플레이 디렉토리 생성
    async ensureReplayDirectory() {
        try {
            await fs.mkdir(this.replayDir, { recursive: true });
        } catch (error) {
            console.error('[Replay System] 디렉토리 생성 실패:', error);
        }
    }

    // 게임 기록 시작
    startRecording(roomId, gameData) {
        const recordingId = uuidv4();
        const recording = {
            id: recordingId,
            roomId: roomId,
            gameId: gameData.gameId,
            startTime: new Date(),
            players: Array.from(gameData.players.values()).map(p => ({
                username: p.username,
                socketId: p.socketId
            })),
            gameMode: gameData.gameMode || 'Basic',
            challengeCards: gameData.challengeCards || [],
            specialistCards: gameData.specialistCards || [],
            events: [],
            metadata: {
                version: '2.1.0',
                gameType: 'TheGang',
                recordedBy: 'SoGang Server'
            }
        };

        this.activeRecordings.set(roomId, recording);
        console.log(`[Replay] 게임 기록 시작: ${roomId} (${recordingId})`);
        return recordingId;
    }

    // 게임 이벤트 기록
    recordEvent(roomId, eventType, eventData) {
        const recording = this.activeRecordings.get(roomId);
        if (!recording) return;

        const event = {
            id: uuidv4(),
            type: eventType,
            timestamp: new Date(),
            data: this.sanitizeEventData(eventData),
            relativeTime: new Date() - recording.startTime
        };

        recording.events.push(event);
        
        // 메모리 사용량 제한 (이벤트 5000개 초과 시 경고)
        if (recording.events.length > 5000) {
            console.warn(`[Replay] 이벤트 수 과다: ${roomId} (${recording.events.length}개)`);
        }
    }

    // 민감한 데이터 제거
    sanitizeEventData(data) {
        const sanitized = JSON.parse(JSON.stringify(data));
        
        // 소켓 ID 같은 민감한 정보 제거
        const removeKeys = ['socketId', 'sessionId', 'ip'];
        const cleanObject = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            for (const key of removeKeys) {
                delete obj[key];
            }
            
            Object.values(obj).forEach(value => {
                if (typeof value === 'object') {
                    cleanObject(value);
                }
            });
            
            return obj;
        };
        
        return cleanObject(sanitized);
    }

    // 게임 기록 종료 및 저장
    async finishRecording(roomId, gameResult) {
        const recording = this.activeRecordings.get(roomId);
        if (!recording) return null;

        recording.endTime = new Date();
        recording.duration = recording.endTime - recording.startTime;
        recording.gameResult = gameResult;
        recording.summary = this.generateGameSummary(recording);

        try {
            // 파일로 저장
            const filename = `${recording.gameId}_${recording.startTime.toISOString().split('T')[0]}.json`;
            const filepath = path.join(this.replayDir, filename);
            await fs.writeFile(filepath, JSON.stringify(recording, null, 2));

            // 데이터베이스에 메타데이터 저장
            await db.saveReplayMetadata({
                id: recording.id,
                gameId: recording.gameId,
                filename: filename,
                players: recording.players.map(p => p.username),
                gameMode: recording.gameMode,
                duration: recording.duration,
                victory: gameResult.victory,
                createdAt: recording.startTime
            });

            console.log(`[Replay] 게임 기록 저장 완료: ${filename}`);
            this.activeRecordings.delete(roomId);
            
            return {
                id: recording.id,
                filename: filename,
                duration: recording.duration
            };
        } catch (error) {
            console.error('[Replay] 게임 기록 저장 실패:', error);
            return null;
        }
    }

    // 게임 요약 생성
    generateGameSummary(recording) {
        const events = recording.events;
        const summary = {
            totalEvents: events.length,
            rounds: [],
            keyMoments: [],
            playerStats: {}
        };

        // 플레이어별 통계 초기화
        recording.players.forEach(player => {
            summary.playerStats[player.username] = {
                actions: 0,
                chipsTaken: 0,
                chipsExchanged: 0,
                passes: 0
            };
        });

        let currentRound = 0;
        let roundStartTime = 0;

        events.forEach(event => {
            switch (event.type) {
                case 'round_started':
                    currentRound = event.data.round;
                    roundStartTime = event.relativeTime;
                    summary.rounds.push({
                        round: currentRound,
                        startTime: event.relativeTime,
                        events: 0
                    });
                    break;

                case 'round_ended':
                    const roundIndex = summary.rounds.length - 1;
                    if (roundIndex >= 0) {
                        summary.rounds[roundIndex].endTime = event.relativeTime;
                        summary.rounds[roundIndex].duration = event.relativeTime - roundStartTime;
                    }
                    break;

                case 'player_action':
                    const player = event.data.player;
                    const action = event.data.action;
                    
                    if (summary.playerStats[player]) {
                        summary.playerStats[player].actions++;
                        
                        switch (action) {
                            case 'takeFromCenter':
                            case 'takeFromPlayer':
                                summary.playerStats[player].chipsTaken++;
                                break;
                            case 'exchangeWithCenter':
                            case 'exchangeWithPlayer':
                                summary.playerStats[player].chipsExchanged++;
                                break;
                            case 'pass':
                                summary.playerStats[player].passes++;
                                break;
                        }
                    }
                    break;

                case 'showdown_result':
                    summary.keyMoments.push({
                        type: 'showdown',
                        time: event.relativeTime,
                        success: event.data.heistSuccess,
                        round: currentRound
                    });
                    break;

                case 'specialist_card_used':
                    summary.keyMoments.push({
                        type: 'specialist_card',
                        time: event.relativeTime,
                        player: event.data.username,
                        card: event.data.cardId
                    });
                    break;
            }

            // 라운드별 이벤트 카운트
            const roundIndex = summary.rounds.length - 1;
            if (roundIndex >= 0) {
                summary.rounds[roundIndex].events++;
            }
        });

        return summary;
    }

    // 리플레이 목록 조회
    async getReplayList(username = null, limit = 20, offset = 0) {
        try {
            const replays = await db.getReplayList(username, limit, offset);
            return replays.map(replay => ({
                id: replay.id,
                gameId: replay.gameId,
                players: replay.players,
                gameMode: replay.gameMode,
                duration: replay.duration,
                victory: replay.victory,
                createdAt: replay.createdAt
            }));
        } catch (error) {
            console.error('[Replay List] 리플레이 목록 조회 실패:', error);
            return [];
        }
    }

    // 리플레이 상세 정보 조회
    async getReplayDetails(replayId) {
        try {
            const metadata = await db.getReplayMetadata(replayId);
            if (!metadata) return null;

            const filepath = path.join(this.replayDir, metadata.filename);
            const replayData = await fs.readFile(filepath, 'utf8');
            const replay = JSON.parse(replayData);

            return {
                metadata: metadata,
                gameData: {
                    players: replay.players,
                    gameMode: replay.gameMode,
                    challengeCards: replay.challengeCards,
                    specialistCards: replay.specialistCards,
                    duration: replay.duration,
                    summary: replay.summary
                },
                events: replay.events
            };
        } catch (error) {
            console.error('[Replay Details] 리플레이 상세 조회 실패:', error);
            return null;
        }
    }

    // 리플레이 재생용 데이터 생성
    async generatePlaybackData(replayId, speedMultiplier = 1.0) {
        try {
            const replayDetails = await this.getReplayDetails(replayId);
            if (!replayDetails) return null;

            const events = replayDetails.events;
            const playbackEvents = events.map(event => ({
                ...event,
                playbackTime: Math.floor(event.relativeTime / speedMultiplier)
            }));

            return {
                metadata: replayDetails.metadata,
                gameData: replayDetails.gameData,
                events: playbackEvents,
                totalDuration: Math.floor(replayDetails.gameData.duration / speedMultiplier),
                speedMultiplier: speedMultiplier
            };
        } catch (error) {
            console.error('[Replay Playback] 재생 데이터 생성 실패:', error);
            return null;
        }
    }

    // 리플레이 분석
    async analyzeReplay(replayId) {
        try {
            const replayDetails = await this.getReplayDetails(replayId);
            if (!replayDetails) return null;

            const events = replayDetails.events;
            const analysis = {
                gameMetrics: {
                    averageRoundDuration: 0,
                    mostActivePlayer: null,
                    chipMovements: 0,
                    totalActions: 0
                },
                playerAnalysis: {},
                criticalMoments: [],
                gameFlow: []
            };

            // 플레이어별 분석 초기화
            replayDetails.gameData.players.forEach(player => {
                analysis.playerAnalysis[player.username] = {
                    actionCount: 0,
                    avgActionTime: 0,
                    chipEfficiency: 0,
                    decisionSpeed: [],
                    preferredActions: {}
                };
            });

            // 이벤트 분석
            let lastActionTime = 0;
            events.forEach(event => {
                if (event.type === 'player_action') {
                    const player = event.data.player;
                    const action = event.data.action;
                    
                    if (analysis.playerAnalysis[player]) {
                        analysis.playerAnalysis[player].actionCount++;
                        
                        // 행동 선호도 추적
                        if (!analysis.playerAnalysis[player].preferredActions[action]) {
                            analysis.playerAnalysis[player].preferredActions[action] = 0;
                        }
                        analysis.playerAnalysis[player].preferredActions[action]++;
                        
                        // 결정 속도 추적
                        if (lastActionTime > 0) {
                            const decisionTime = event.relativeTime - lastActionTime;
                            analysis.playerAnalysis[player].decisionSpeed.push(decisionTime);
                        }
                        
                        lastActionTime = event.relativeTime;
                    }
                    
                    analysis.gameMetrics.totalActions++;
                }
                
                if (event.type.includes('chip')) {
                    analysis.gameMetrics.chipMovements++;
                }
                
                if (event.type === 'showdown_result') {
                    analysis.criticalMoments.push({
                        time: event.relativeTime,
                        type: 'showdown',
                        success: event.data.heistSuccess,
                        impact: event.data.heistSuccess ? 'positive' : 'negative'
                    });
                }
            });

            // 평균 계산
            Object.keys(analysis.playerAnalysis).forEach(player => {
                const playerData = analysis.playerAnalysis[player];
                if (playerData.decisionSpeed.length > 0) {
                    playerData.avgActionTime = playerData.decisionSpeed.reduce((a, b) => a + b) / playerData.decisionSpeed.length;
                }
            });

            // 가장 활발한 플레이어 찾기
            let maxActions = 0;
            Object.entries(analysis.playerAnalysis).forEach(([player, data]) => {
                if (data.actionCount > maxActions) {
                    maxActions = data.actionCount;
                    analysis.gameMetrics.mostActivePlayer = player;
                }
            });

            return analysis;
        } catch (error) {
            console.error('[Replay Analysis] 리플레이 분석 실패:', error);
            return null;
        }
    }

    // 리플레이 삭제
    async deleteReplay(replayId, username = null) {
        try {
            const metadata = await db.getReplayMetadata(replayId);
            if (!metadata) return false;

            // 권한 확인 (본인의 리플레이이거나 관리자인 경우)
            if (username && !metadata.players.includes(username)) {
                const isAdmin = await db.isUserAdmin(username);
                if (!isAdmin) {
                    return false;
                }
            }

            // 파일 삭제
            const filepath = path.join(this.replayDir, metadata.filename);
            await fs.unlink(filepath);

            // 데이터베이스에서 메타데이터 삭제
            await db.deleteReplayMetadata(replayId);

            console.log(`[Replay Delete] 리플레이 삭제: ${replayId}`);
            return true;
        } catch (error) {
            console.error('[Replay Delete] 리플레이 삭제 실패:', error);
            return false;
        }
    }

    // 리플레이 공유
    async shareReplay(replayId, shareType = 'public') {
        try {
            await db.updateReplayShareStatus(replayId, shareType);
            console.log(`[Replay Share] 리플레이 공유 설정: ${replayId} -> ${shareType}`);
            return true;
        } catch (error) {
            console.error('[Replay Share] 리플레이 공유 실패:', error);
            return false;
        }
    }

    // 하이라이트 클립 생성
    createHighlightClip(replayId, startTime, endTime, title) {
        // 하이라이트 클립 생성 로직
        // 특정 시간 구간의 이벤트만 추출하여 별도 클립 생성
        return {
            id: uuidv4(),
            replayId: replayId,
            title: title,
            startTime: startTime,
            endTime: endTime,
            createdAt: new Date()
        };
    }

    // 오래된 리플레이 정리
    async cleanupOldReplays(daysToKeep = 90) {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            const oldReplays = await db.getOldReplays(cutoffDate);

            for (const replay of oldReplays) {
                try {
                    const filepath = path.join(this.replayDir, replay.filename);
                    await fs.unlink(filepath);
                    await db.deleteReplayMetadata(replay.id);
                    console.log(`[Replay Cleanup] 삭제: ${replay.filename}`);
                } catch (error) {
                    console.error(`[Replay Cleanup] 삭제 실패: ${replay.filename}`, error);
                }
            }

            console.log(`[Replay Cleanup] ${oldReplays.length}개 리플레이 정리 완료`);
        } catch (error) {
            console.error('[Replay Cleanup] 리플레이 정리 실패:', error);
        }
    }
}

module.exports = ReplaySystemManager;