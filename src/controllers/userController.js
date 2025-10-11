const db = require('../../database');

// 유저 통계 조회
const getUserStats = async (req, res) => {
    try {
        const { username } = req.params;
        
        // 본인 또는 관리자만 조회 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '통계를 조회할 권한이 없습니다.' });
        }

        const stats = await db.getUserStats(username);
        if (!stats) {
            return res.status(404).json({ success: false, error: '유저 통계를 찾을 수 없습니다.' });
        }

        res.json({ success: true, stats });
    } catch (error) {
        console.error('유저 통계 조회 실패:', error);
        res.status(500).json({ success: false, error: '유저 통계를 불러올 수 없습니다.' });
    }
};

// 유저 통계 업데이트
const updateUserStats = async (req, res) => {
    try {
        const { username } = req.params;
        const { totalGames, totalWins, totalLosses, totalChipsWon, totalChipsLost, bestHand } = req.body;

        // 본인 또는 관리자만 업데이트 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '통계를 업데이트할 권한이 없습니다.' });
        }

        const stats = {
            totalGames: totalGames || 0,
            totalWins: totalWins || 0,
            totalLosses: totalLosses || 0,
            totalChipsWon: totalChipsWon || 0,
            totalChipsLost: totalChipsLost || 0,
            bestHand: bestHand || null
        };

        await db.updateUserStats(username, stats);

        res.json({ 
            success: true, 
            message: '유저 통계가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('유저 통계 업데이트 실패:', error);
        res.status(500).json({ success: false, error: '유저 통계를 업데이트할 수 없습니다.' });
    }
};

// 유저 장점 상태 조회
const getUserAdvStatus = async (req, res) => {
    try {
        const { username } = req.params;
        
        // 본인 또는 관리자만 조회 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '장점 상태를 조회할 권한이 없습니다.' });
        }

        const advStatus = await db.getUserAdvStatus(username);
        
        // 10개 상태가 모두 있는지 확인하고, 없으면 초기화
        if (advStatus.length < 10) {
            await db.initializeUserStatus(username);
            const updatedAdvStatus = await db.getUserAdvStatus(username);
            res.json({ success: true, advStatus: updatedAdvStatus });
        } else {
            res.json({ success: true, advStatus });
        }
    } catch (error) {
        console.error('유저 장점 상태 조회 실패:', error);
        res.status(500).json({ success: false, error: '장점 상태를 불러올 수 없습니다.' });
    }
};

// 유저 장점 상태 업데이트
const updateUserAdvStatus = async (req, res) => {
    try {
        const { username } = req.params;
        const { statusType, statusName, level, points, description } = req.body;

        // 본인 또는 관리자만 업데이트 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '장점 상태를 업데이트할 권한이 없습니다.' });
        }

        if (!statusType || !statusName) {
            return res.status(400).json({ success: false, error: '상태 타입과 이름이 필요합니다.' });
        }

        if (statusType < 1 || statusType > 10) {
            return res.status(400).json({ success: false, error: '상태 타입은 1-10 사이여야 합니다.' });
        }

        if (level && (level < 1 || level > 5)) {
            return res.status(400).json({ success: false, error: '레벨은 1-5 사이여야 합니다.' });
        }

        await db.updateUserAdvStatus(username, statusType, statusName, level || 1, points || 0, description);

        res.json({ 
            success: true, 
            message: '장점 상태가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('유저 장점 상태 업데이트 실패:', error);
        res.status(500).json({ success: false, error: '장점 상태를 업데이트할 수 없습니다.' });
    }
};

// 유저 단점 상태 조회
const getUserDisStatus = async (req, res) => {
    try {
        const { username } = req.params;
        
        // 본인 또는 관리자만 조회 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '단점 상태를 조회할 권한이 없습니다.' });
        }

        const disStatus = await db.getUserDisStatus(username);
        
        // 10개 상태가 모두 있는지 확인하고, 없으면 초기화
        if (disStatus.length < 10) {
            await db.initializeUserStatus(username);
            const updatedDisStatus = await db.getUserDisStatus(username);
            res.json({ success: true, disStatus: updatedDisStatus });
        } else {
            res.json({ success: true, disStatus });
        }
    } catch (error) {
        console.error('유저 단점 상태 조회 실패:', error);
        res.status(500).json({ success: false, error: '단점 상태를 불러올 수 없습니다.' });
    }
};

// 유저 단점 상태 업데이트
const updateUserDisStatus = async (req, res) => {
    try {
        const { username } = req.params;
        const { statusType, statusName, level, points, description } = req.body;

        // 본인 또는 관리자만 업데이트 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '단점 상태를 업데이트할 권한이 없습니다.' });
        }

        if (!statusType || !statusName) {
            return res.status(400).json({ success: false, error: '상태 타입과 이름이 필요합니다.' });
        }

        if (statusType < 1 || statusType > 10) {
            return res.status(400).json({ success: false, error: '상태 타입은 1-10 사이여야 합니다.' });
        }

        if (level && (level < 1 || level > 5)) {
            return res.status(400).json({ success: false, error: '레벨은 1-5 사이여야 합니다.' });
        }

        await db.updateUserDisStatus(username, statusType, statusName, level || 1, points || 0, description);

        res.json({ 
            success: true, 
            message: '단점 상태가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('유저 단점 상태 업데이트 실패:', error);
        res.status(500).json({ success: false, error: '단점 상태를 업데이트할 수 없습니다.' });
    }
};

// 유저 게임 히스토리 조회
const getUserGameHistory = async (req, res) => {
    try {
        const { username } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        // 본인 또는 관리자만 조회 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '게임 히스토리를 조회할 권한이 없습니다.' });
        }

        // 입력 검증 및 파싱
        const parsedLimit = parseInt(limit) || 20;
        const parsedOffset = parseInt(offset) || 0;

        // 범위 검증
        if (parsedLimit < 1 || parsedLimit > 100) {
            return res.status(400).json({ success: false, error: 'limit은 1-100 사이여야 합니다.' });
        }

        if (parsedOffset < 0) {
            return res.status(400).json({ success: false, error: 'offset은 0 이상이어야 합니다.' });
        }

        // 유저가 참가한 게임들 조회
        const games = await db.query(`
            SELECT g.*, gp.final_rank, gp.chips_at_start, gp.chips_at_end
            FROM games g
            JOIN game_players gp ON g.id = gp.game_id
            WHERE gp.username = ?
            ORDER BY g.created_at DESC
            LIMIT ? OFFSET ?
        `, [username, parsedLimit, parsedOffset]);

        // 총 게임 수 조회
        const totalCount = await db.get(`
            SELECT COUNT(*) as count
            FROM game_players
            WHERE username = ?
        `, [username]);

        res.json({
            success: true,
            games,
            totalCount: totalCount?.count || 0,
            limit: parsedLimit,
            offset: parsedOffset
        });
    } catch (error) {
        console.error('유저 게임 히스토리 조회 실패:', error);
        res.status(500).json({ success: false, error: '게임 히스토리를 불러올 수 없습니다.' });
    }
};

// 유저 업적 조회
const getUserAchievements = async (req, res) => {
    try {
        const { username } = req.params;
        
        // 본인 또는 관리자만 조회 가능
        if (req.session.username !== username && !req.session.isAdmin) {
            return res.status(403).json({ success: false, error: '업적을 조회할 권한이 없습니다.' });
        }

        const [stats, advStatus, disStatus] = await Promise.all([
            db.getUserStats(username),
            db.getUserAdvStatus(username),
            db.getUserDisStatus(username)
        ]);

        // Null 체크
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: '유저 통계를 찾을 수 없습니다.'
            });
        }

        // 업적 계산
        const achievements = {
            // 게임 관련 업적
            totalGames: stats?.total_games || 0,
            totalWins: stats?.total_wins || 0,
            winRate: stats?.total_games > 0 ? (stats.total_wins / stats.total_games * 100).toFixed(1) : 0,
            
            // 칩 관련 업적
            totalChipsWon: stats?.total_chips_won || 0,
            totalChipsLost: stats?.total_chips_lost || 0,
            netChips: (stats?.total_chips_won || 0) - (stats?.total_chips_lost || 0),
            
            // 상태 관련 업적
            advStatusLevels: advStatus?.map(s => s.level) || [],
            disStatusLevels: disStatus?.map(s => s.level) || [],
            avgAdvLevel: advStatus?.length > 0 ? 
                (advStatus.reduce((sum, s) => sum + s.level, 0) / advStatus.length).toFixed(1) : 0,
            avgDisLevel: disStatus?.length > 0 ? 
                (disStatus.reduce((sum, s) => sum + s.level, 0) / disStatus.length).toFixed(1) : 0,
            
            // 특별 업적
            specialAchievements: []
        };

        // 특별 업적 추가
        if (achievements.totalGames >= 100) {
            achievements.specialAchievements.push({ name: '백전노장', description: '100게임 달성' });
        }
        if (achievements.winRate >= 60) {
            achievements.specialAchievements.push({ name: '승률왕', description: '60% 이상 승률 달성' });
        }
        if (achievements.netChips >= 10000) {
            achievements.specialAchievements.push({ name: '부자', description: '10,000칩 이상 수익' });
        }
        if (achievements.avgAdvLevel >= 4) {
            achievements.specialAchievements.push({ name: '장점 마스터', description: '평균 장점 레벨 4 이상' });
        }

        res.json({ success: true, achievements });
    } catch (error) {
        console.error('유저 업적 조회 실패:', error);
        res.status(500).json({ success: false, error: '업적을 불러올 수 없습니다.' });
    }
};

module.exports = {
    getUserStats,
    updateUserStats,
    getUserAdvStatus,
    updateUserAdvStatus,
    getUserDisStatus,
    updateUserDisStatus,
    getUserGameHistory,
    getUserAchievements
};
