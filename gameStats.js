// 게임 통계 및 히스토리 관리 시스템
const db = require('./database');

class GameStatsManager {
    constructor() {
        this.sessionStats = new Map(); // 세션별 임시 통계
    }

    // 게임 히스토리 저장
    async saveGameHistory(roomId, gameData) {
        try {
            const {
                gameId,
                players,
                gameMode,
                challengeCards,
                specialistCards,
                finalStats,
                heists
            } = gameData;

            // 게임 기본 정보 저장
            await db.updateGameStatus(gameId, 'completed', gameData.startedAt, new Date());
            
            // 각 하이스트 결과 저장
            for (let i = 0; i < heists.length; i++) {
                const heist = heists[i];
                await db.createGameRound(gameId, i + 1, 'showdown', heist.communityCards);
                
                // 플레이어별 하이스트 결과 저장
                for (const [playerId, playerData] of heist.players) {
                    await db.recordPlayerAction(
                        gameId,
                        i + 1,
                        playerData.username,
                        'heist_result',
                        heist.success ? 1 : 0,
                        playerData.finalChipStars || 0
                    );
                }
            }

            console.log(`[Game History] 게임 히스토리 저장 완료: ${gameId}`);
            return true;
        } catch (error) {
            console.error('[Game History] 히스토리 저장 실패:', error);
            return false;
        }
    }

    // 사용자 통계 업데이트
    async updateUserStats(username, gameResult) {
        try {
            const {
                victory,
                vaults,
                alarms,
                gameMode,
                totalHeists,
                successfulHeists
            } = gameResult;

            // 기존 통계 조회
            const existingStats = await db.getUserStats(username) || {
                games_played: 0,
                games_won: 0,
                total_vaults: 0,
                total_alarms: 0,
                best_vault_streak: 0,
                favorite_mode: 'Basic'
            };

            // 통계 업데이트
            const newStats = {
                games_played: existingStats.games_played + 1,
                games_won: existingStats.games_won + (victory ? 1 : 0),
                total_vaults: existingStats.total_vaults + vaults,
                total_alarms: existingStats.total_alarms + alarms,
                best_vault_streak: Math.max(existingStats.best_vault_streak, vaults),
                favorite_mode: gameMode || existingStats.favorite_mode,
                last_played: new Date(),
                heist_success_rate: successfulHeists / totalHeists,
                average_vaults_per_game: (existingStats.total_vaults + vaults) / (existingStats.games_played + 1)
            };

            await db.updateUserStats(username, newStats);
            console.log(`[User Stats] ${username} 통계 업데이트 완료`);
            return newStats;
        } catch (error) {
            console.error('[User Stats] 통계 업데이트 실패:', error);
            return null;
        }
    }

    // 리더보드 조회
    async getLeaderboards() {
        try {
            const leaderboards = {
                // 승률 순위
                winRate: await db.getUserLeaderboard('win_rate', 10),
                // 총 금고 수 순위
                totalVaults: await db.getUserLeaderboard('total_vaults', 10),
                // 연속 금고 기록 순위
                vaultStreak: await db.getUserLeaderboard('best_vault_streak', 10),
                // 게임 수 순위
                gamesPlayed: await db.getUserLeaderboard('games_played', 10)
            };

            return leaderboards;
        } catch (error) {
            console.error('[Leaderboards] 리더보드 조회 실패:', error);
            return null;
        }
    }

    // 사용자 개인 통계 조회
    async getUserProfile(username) {
        try {
            const stats = await db.getUserStats(username);
            const recentGames = await db.getUserRecentGames(username, 10);
            const achievements = await this.calculateAchievements(username, stats);

            return {
                username,
                stats,
                recentGames,
                achievements,
                level: this.calculateLevel(stats),
                nextLevelExp: this.getNextLevelExp(stats)
            };
        } catch (error) {
            console.error('[User Profile] 프로필 조회 실패:', error);
            return null;
        }
    }

    // 도전과제 계산
    async calculateAchievements(username, stats) {
        const achievements = [];

        // 기본 도전과제들
        if (stats.games_played >= 1) {
            achievements.push({
                id: 'first_game',
                name: '첫 번째 하이스트',
                description: '첫 번째 게임 완료',
                unlocked: true,
                unlockedAt: stats.created_at
            });
        }

        if (stats.games_won >= 1) {
            achievements.push({
                id: 'first_win',
                name: '성공한 도둑',
                description: '첫 번째 승리',
                unlocked: true
            });
        }

        if (stats.games_won >= 10) {
            achievements.push({
                id: 'veteran_thief',
                name: '베테랑 도둑',
                description: '10번 승리',
                unlocked: true
            });
        }

        if (stats.best_vault_streak >= 3) {
            achievements.push({
                id: 'perfect_heist',
                name: '완벽한 하이스트',
                description: '한 게임에서 3개 금고 모두 성공',
                unlocked: true
            });
        }

        if (stats.total_vaults >= 50) {
            achievements.push({
                id: 'vault_hunter',
                name: '금고 사냥꾼',
                description: '총 50개 금고 털기',
                unlocked: true
            });
        }

        // 승률 관련 도전과제
        const winRate = stats.games_played > 0 ? stats.games_won / stats.games_played : 0;
        if (winRate >= 0.8 && stats.games_played >= 10) {
            achievements.push({
                id: 'master_thief',
                name: '마스터 도둑',
                description: '80% 이상 승률 유지 (10게임 이상)',
                unlocked: true
            });
        }

        return achievements;
    }

    // 레벨 계산
    calculateLevel(stats) {
        const exp = (stats.games_won * 10) + (stats.total_vaults * 5) + (stats.games_played * 1);
        return Math.floor(exp / 100) + 1;
    }

    // 다음 레벨까지 필요한 경험치
    getNextLevelExp(stats) {
        const currentLevel = this.calculateLevel(stats);
        const currentExp = (stats.games_won * 10) + (stats.total_vaults * 5) + (stats.games_played * 1);
        const nextLevelExp = currentLevel * 100;
        return nextLevelExp - currentExp;
    }

    // 게임 분석 데이터
    async getGameAnalytics(timeframe = '7days') {
        try {
            const analytics = {
                totalGames: await db.getTotalGamesCount(timeframe),
                totalPlayers: await db.getActivePlayersCount(timeframe),
                averageGameDuration: await db.getAverageGameDuration(timeframe),
                modePopularity: await db.getGameModePopularity(timeframe),
                winRateByMode: await db.getWinRateByMode(timeframe),
                peakHours: await db.getPeakPlayingHours(timeframe)
            };

            return analytics;
        } catch (error) {
            console.error('[Analytics] 분석 데이터 조회 실패:', error);
            return null;
        }
    }

    // 실시간 통계 추적
    trackRealTimeStats(roomId, eventType, data) {
        if (!this.sessionStats.has(roomId)) {
            this.sessionStats.set(roomId, {
                startTime: new Date(),
                events: [],
                players: new Set(),
                heists: []
            });
        }

        const sessionData = this.sessionStats.get(roomId);
        sessionData.events.push({
            type: eventType,
            timestamp: new Date(),
            data: data
        });

        // 특정 이벤트에 따른 처리
        switch (eventType) {
            case 'player_joined':
                sessionData.players.add(data.username);
                break;
            case 'heist_completed':
                sessionData.heists.push({
                    heistNumber: sessionData.heists.length + 1,
                    success: data.success,
                    players: data.players,
                    communityCards: data.communityCards,
                    timestamp: new Date()
                });
                break;
            case 'game_ended':
                // 세션 종료 시 최종 통계 계산
                this.finalizeSessionStats(roomId, data);
                break;
        }
    }

    // 세션 통계 최종화
    async finalizeSessionStats(roomId, gameEndData) {
        try {
            const sessionData = this.sessionStats.get(roomId);
            if (!sessionData) return;

            const finalStats = {
                gameId: gameEndData.gameId,
                players: Array.from(sessionData.players),
                gameMode: gameEndData.gameMode,
                challengeCards: gameEndData.challengeCards || [],
                specialistCards: gameEndData.specialistCards || [],
                finalStats: gameEndData.finalStats,
                heists: sessionData.heists,
                totalDuration: new Date() - sessionData.startTime,
                startedAt: sessionData.startTime
            };

            // 게임 히스토리 저장
            await this.saveGameHistory(roomId, finalStats);

            // 각 플레이어 통계 업데이트
            for (const username of sessionData.players) {
                const playerResult = {
                    victory: gameEndData.finalStats.victory,
                    vaults: gameEndData.finalStats.vaults,
                    alarms: gameEndData.finalStats.alarms,
                    gameMode: gameEndData.gameMode,
                    totalHeists: sessionData.heists.length,
                    successfulHeists: sessionData.heists.filter(h => h.success).length
                };
                
                await this.updateUserStats(username, playerResult);
            }

            // 세션 데이터 정리
            this.sessionStats.delete(roomId);
            
            console.log(`[Session Stats] 세션 통계 최종화 완료: ${roomId}`);
        } catch (error) {
            console.error('[Session Stats] 세션 통계 최종화 실패:', error);
        }
    }

    // 세션별 실시간 통계 조회
    getSessionStats(roomId) {
        return this.sessionStats.get(roomId) || null;
    }
}

// 글로벌 통계 함수들
async function getGlobalStats() {
    try {
        const stats = {
            totalGames: await db.getTotalGamesCount(),
            totalPlayers: await db.getTotalPlayersCount(),
            totalVaultsStolen: await db.getTotalVaultsCount(),
            averageSuccessRate: await db.getAverageSuccessRate(),
            mostPopularMode: await db.getMostPopularGameMode(),
            topPlayers: await db.getTopPlayers(5)
        };

        return stats;
    } catch (error) {
        console.error('[Global Stats] 글로벌 통계 조회 실패:', error);
        return null;
    }
}

// 일일 통계 생성 (크론 작업용)
async function generateDailyStats() {
    try {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        
        const dailyStats = {
            date: yesterday,
            gamesPlayed: await db.getGamesCountByDate(yesterday),
            uniquePlayers: await db.getUniquePlayersCountByDate(yesterday),
            totalVaults: await db.getVaultsCountByDate(yesterday),
            averageGameDuration: await db.getAverageGameDurationByDate(yesterday)
        };

        await db.saveDailyStats(dailyStats);
        console.log(`[Daily Stats] ${yesterday.toISOString().split('T')[0]} 일일 통계 생성 완료`);
        
        return dailyStats;
    } catch (error) {
        console.error('[Daily Stats] 일일 통계 생성 실패:', error);
        return null;
    }
}

module.exports = {
    GameStatsManager,
    getGlobalStats,
    generateDailyStats
};