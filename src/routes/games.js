const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { requireAuth } = require('../middleware/auth');

// 게임 관련 라우트들
router.get('/', requireAuth, gameController.getGames);
router.post('/', requireAuth, gameController.createGame);
router.get('/:id', requireAuth, gameController.getGame);
router.put('/:id/start', requireAuth, gameController.startGame);
router.put('/:id/end', requireAuth, gameController.endGame);

// 게임 플레이어 관련 라우트들
router.get('/:id/players', requireAuth, gameController.getGamePlayers);
router.post('/:id/players', requireAuth, gameController.addPlayerToGame);
router.put('/:id/players/:username', requireAuth, gameController.updatePlayerStatus);

// 게임 라운드 관련 라우트들
router.get('/:id/rounds', requireAuth, gameController.getGameRounds);
router.post('/:id/rounds', requireAuth, gameController.createGameRound);
router.put('/:id/rounds/:roundNumber', requireAuth, gameController.updateGameRound);

// 게임 액션 관련 라우트들
router.get('/:id/actions', requireAuth, gameController.getGameActions);
router.post('/:id/actions', requireAuth, gameController.recordGameAction);

// 게임 통계 관련 라우트들
router.get('/:id/statistics', requireAuth, gameController.getGameStatistics);

module.exports = router;
