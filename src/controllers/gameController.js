const db = require('../../database');

// 게임 목록 조회
const getGames = async (req, res) => {
    try {
        const games = await db.getActiveGames();
        res.json({ success: true, games });
    } catch (error) {
        console.error('게임 목록 조회 실패:', error);
        res.status(500).json({ success: false, error: '게임 목록을 불러올 수 없습니다.' });
    }
};

// 새 게임 생성
const createGame = async (req, res) => {
    try {
        const { name, maxPlayers = 6 } = req.body;
        const hostUsername = req.session.username;

        if (!name) {
            return res.status(400).json({ success: false, error: '게임 이름이 필요합니다.' });
        }

        const result = await db.createGame(name, hostUsername, maxPlayers);
        const gameId = result.lastID;

        // 호스트를 첫 번째 플레이어로 추가
        await db.addPlayerToGame(gameId, hostUsername, 0);

        res.json({ 
            success: true, 
            gameId,
            message: '게임이 성공적으로 생성되었습니다.' 
        });
    } catch (error) {
        console.error('게임 생성 실패:', error);
        res.status(500).json({ success: false, error: '게임을 생성할 수 없습니다.' });
    }
};

// 특정 게임 정보 조회
const getGame = async (req, res) => {
    try {
        const { id } = req.params;
        const game = await db.getGame(id);
        
        if (!game) {
            return res.status(404).json({ success: false, error: '게임을 찾을 수 없습니다.' });
        }

        const players = await db.getGamePlayers(id);
        const rounds = await db.query('SELECT * FROM game_rounds WHERE game_id = ? ORDER BY round_number', [id]);

        res.json({ 
            success: true, 
            game: { ...game, players, rounds } 
        });
    } catch (error) {
        console.error('게임 정보 조회 실패:', error);
        res.status(500).json({ success: false, error: '게임 정보를 불러올 수 없습니다.' });
    }
};

// 게임 시작
const startGame = async (req, res) => {
    try {
        const { id } = req.params;
        const game = await db.getGame(id);
        
        if (!game) {
            return res.status(404).json({ success: false, error: '게임을 찾을 수 없습니다.' });
        }

        if (game.host_username !== req.session.username) {
            return res.status(403).json({ success: false, error: '게임을 시작할 권한이 없습니다.' });
        }

        if (game.status !== 'waiting') {
            return res.status(400).json({ success: false, error: '게임이 이미 시작되었거나 종료되었습니다.' });
        }

        const players = await db.getGamePlayers(id);
        if (players.length < 2) {
            return res.status(400).json({ success: false, error: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' });
        }

        await db.updateGameStatus(id, 'playing', new Date().toISOString());

        res.json({ 
            success: true, 
            message: '게임이 시작되었습니다.' 
        });
    } catch (error) {
        console.error('게임 시작 실패:', error);
        res.status(500).json({ success: false, error: '게임을 시작할 수 없습니다.' });
    }
};

// 게임 종료
const endGame = async (req, res) => {
    try {
        const { id } = req.params;
        const game = await db.getGame(id);
        
        if (!game) {
            return res.status(404).json({ success: false, error: '게임을 찾을 수 없습니다.' });
        }

        if (game.host_username !== req.session.username) {
            return res.status(403).json({ success: false, error: '게임을 종료할 권한이 없습니다.' });
        }

        await db.updateGameStatus(id, 'finished', null, new Date().toISOString());

        res.json({ 
            success: true, 
            message: '게임이 종료되었습니다.' 
        });
    } catch (error) {
        console.error('게임 종료 실패:', error);
        res.status(500).json({ success: false, error: '게임을 종료할 수 없습니다.' });
    }
};

// 게임 플레이어 목록 조회
const getGamePlayers = async (req, res) => {
    try {
        const { id } = req.params;
        const players = await db.getGamePlayers(id);
        res.json({ success: true, players });
    } catch (error) {
        console.error('게임 플레이어 목록 조회 실패:', error);
        res.status(500).json({ success: false, error: '플레이어 목록을 불러올 수 없습니다.' });
    }
};

// 게임에 플레이어 추가
const addPlayerToGame = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, seatPosition, chipsAtStart = 1000 } = req.body;

        if (!username || seatPosition === undefined) {
            return res.status(400).json({ success: false, error: '유저명과 좌석 위치가 필요합니다.' });
        }

        const game = await db.getGame(id);
        if (!game) {
            return res.status(404).json({ success: false, error: '게임을 찾을 수 없습니다.' });
        }

        if (game.status !== 'waiting') {
            return res.status(400).json({ success: false, error: '대기 중인 게임에만 참가할 수 있습니다.' });
        }

        const existingPlayers = await db.getGamePlayers(id);
        if (existingPlayers.length >= game.max_players) {
            return res.status(400).json({ success: false, error: '게임이 가득 찼습니다.' });
        }

        // 좌석 중복 확인
        const seatTaken = existingPlayers.some(p => p.seat_position === seatPosition);
        if (seatTaken) {
            return res.status(400).json({ success: false, error: '해당 좌석은 이미 사용 중입니다.' });
        }

        await db.addPlayerToGame(id, username, seatPosition, chipsAtStart);

        res.json({ 
            success: true, 
            message: '게임에 성공적으로 참가했습니다.' 
        });
    } catch (error) {
        console.error('게임 참가 실패:', error);
        res.status(500).json({ success: false, error: '게임에 참가할 수 없습니다.' });
    }
};

// 플레이어 상태 업데이트
const updatePlayerStatus = async (req, res) => {
    try {
        const { id, username } = req.params;
        const { chipsAfter, finalRank } = req.body;

        if (chipsAfter === undefined) {
            return res.status(400).json({ success: false, error: '칩 수가 필요합니다.' });
        }

        await db.updatePlayerChips(id, username, chipsAfter, finalRank);

        res.json({ 
            success: true, 
            message: '플레이어 상태가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('플레이어 상태 업데이트 실패:', error);
        res.status(500).json({ success: false, error: '플레이어 상태를 업데이트할 수 없습니다.' });
    }
};

// 게임 라운드 목록 조회
const getGameRounds = async (req, res) => {
    try {
        const { id } = req.params;
        const rounds = await db.query('SELECT * FROM game_rounds WHERE game_id = ? ORDER BY round_number', [id]);
        res.json({ success: true, rounds });
    } catch (error) {
        console.error('게임 라운드 목록 조회 실패:', error);
        res.status(500).json({ success: false, error: '라운드 목록을 불러올 수 없습니다.' });
    }
};

// 새 게임 라운드 생성
const createGameRound = async (req, res) => {
    try {
        const { id } = req.params;
        const { roundNumber, phase, communityCards } = req.body;

        if (!roundNumber || !phase) {
            return res.status(400).json({ success: false, error: '라운드 번호와 단계가 필요합니다.' });
        }

        await db.createGameRound(id, roundNumber, phase, communityCards);

        res.json({ 
            success: true, 
            message: '새 라운드가 시작되었습니다.' 
        });
    } catch (error) {
        console.error('게임 라운드 생성 실패:', error);
        res.status(500).json({ success: false, error: '라운드를 생성할 수 없습니다.' });
    }
};

// 게임 라운드 업데이트
const updateGameRound = async (req, res) => {
    try {
        const { id, roundNumber } = req.params;
        const { potAmount, endRound } = req.body;

        if (potAmount !== undefined) {
            await db.updateRoundPot(id, roundNumber, potAmount);
        }

        if (endRound) {
            await db.endRound(id, roundNumber);
        }

        res.json({ 
            success: true, 
            message: '라운드가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('게임 라운드 업데이트 실패:', error);
        res.status(500).json({ success: false, error: '라운드를 업데이트할 수 없습니다.' });
    }
};

// 게임 액션 목록 조회
const getGameActions = async (req, res) => {
    try {
        const { id } = req.params;
        const { roundNumber } = req.query;

        let actions;
        if (roundNumber) {
            actions = await db.getPlayerActions(id, roundNumber);
        } else {
            actions = await db.query('SELECT * FROM player_actions WHERE game_id = ? ORDER BY round_number, timestamp', [id]);
        }

        res.json({ success: true, actions });
    } catch (error) {
        console.error('게임 액션 목록 조회 실패:', error);
        res.status(500).json({ success: false, error: '액션 목록을 불러올 수 없습니다.' });
    }
};

// 게임 액션 기록
const recordGameAction = async (req, res) => {
    try {
        const { id } = req.params;
        const { roundNumber, username, actionType, amount = 0, position } = req.body;

        if (!roundNumber || !username || !actionType) {
            return res.status(400).json({ success: false, error: '라운드 번호, 유저명, 액션 타입이 필요합니다.' });
        }

        await db.recordPlayerAction(id, roundNumber, username, actionType, amount, position);

        res.json({ 
            success: true, 
            message: '액션이 기록되었습니다.' 
        });
    } catch (error) {
        console.error('게임 액션 기록 실패:', error);
        res.status(500).json({ success: false, error: '액션을 기록할 수 없습니다.' });
    }
};

// 게임 통계 조회
const getGameStatistics = async (req, res) => {
    try {
        const { id } = req.params;
        
        const game = await db.getGame(id);
        const players = await db.getGamePlayers(id);
        const rounds = await db.query('SELECT * FROM game_rounds WHERE game_id = ? ORDER BY round_number', [id]);
        const actions = await db.query('SELECT * FROM player_actions WHERE game_id = ? ORDER BY round_number, timestamp', [id]);

        // 통계 계산
        const totalPot = rounds.reduce((sum, round) => sum + (round.pot_amount || 0), 0);
        const totalActions = actions.length;
        const playerStats = players.map(player => ({
            username: player.username,
            chipsChange: (player.chips_at_end || player.chips_at_start) - player.chips_at_start,
            finalRank: player.final_rank
        }));

        const statistics = {
            gameId: id,
            totalPot,
            totalRounds: rounds.length,
            totalActions,
            playerStats,
            gameDuration: game.ended_at && game.started_at ? 
                new Date(game.ended_at) - new Date(game.started_at) : null
        };

        res.json({ success: true, statistics });
    } catch (error) {
        console.error('게임 통계 조회 실패:', error);
        res.status(500).json({ success: false, error: '게임 통계를 불러올 수 없습니다.' });
    }
};

module.exports = {
    getGames,
    createGame,
    getGame,
    startGame,
    endGame,
    getGamePlayers,
    addPlayerToGame,
    updatePlayerStatus,
    getGameRounds,
    createGameRound,
    updateGameRound,
    getGameActions,
    recordGameAction,
    getGameStatistics
};
