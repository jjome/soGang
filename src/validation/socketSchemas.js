const Joi = require('joi');
const { GAME_CONSTANTS } = require('../../constants');

// 공통 스키마
const usernameSchema = Joi.string().min(2).max(20).required();
const roomIdSchema = Joi.string().uuid().required();
const chipAmountSchema = Joi.number().integer().min(0).max(10000).required();

// 방 생성 및 관리 스키마
const createRoomSchema = Joi.object({
    roomName: Joi.string().min(1).max(50).required(),
    maxPlayers: Joi.number().integer().min(GAME_CONSTANTS.MIN_PLAYERS).max(GAME_CONSTANTS.MAX_PLAYERS).required(),
    gameMode: Joi.string().valid('BASIC', 'ADVANCED', 'DISADVANTAGE').required()
});

const joinRoomSchema = Joi.object({
    roomId: roomIdSchema
});

const updateGameSettingsSchema = Joi.object({
    roomId: roomIdSchema,
    settings: Joi.object({
        maxPlayers: Joi.number().integer().min(GAME_CONSTANTS.MIN_PLAYERS).max(GAME_CONSTANTS.MAX_PLAYERS).optional(),
        gameMode: Joi.string().valid('BASIC', 'ADVANCED', 'DISADVANTAGE').optional()
    }).required()
});

// 칩 관련 스키마
const takeFromCenterSchema = Joi.object({
    roomId: roomIdSchema,
    chips: chipAmountSchema
});

const takeFromPlayerSchema = Joi.object({
    roomId: roomIdSchema,
    targetUsername: usernameSchema,
    chips: chipAmountSchema
});

const exchangeWithCenterSchema = Joi.object({
    roomId: roomIdSchema,
    giveChips: chipAmountSchema,
    takeChips: chipAmountSchema
});

const exchangeWithPlayerSchema = Joi.object({
    roomId: roomIdSchema,
    targetUsername: usernameSchema,
    giveChips: chipAmountSchema,
    takeChips: chipAmountSchema
});

// 게임 액션 스키마
const passSchema = Joi.object({
    roomId: roomIdSchema
});

const showdownConfirmSchema = Joi.object({
    roomId: roomIdSchema
});

// 채팅 스키마
const chatMessageSchema = Joi.object({
    roomId: roomIdSchema,
    message: Joi.string().min(1).max(GAME_CONSTANTS.MAX_MESSAGE_LENGTH).required()
});

// 검증 미들웨어 생성 함수
const createValidator = (schema) => {
    return (data) => {
        const { error, value } = schema.validate(data, {
            abortEarly: false,  // 모든 에러를 수집
            stripUnknown: true  // 스키마에 없는 필드 제거
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return { valid: false, errors };
        }

        return { valid: true, value };
    };
};

// 검증 함수 export
module.exports = {
    validators: {
        createRoom: createValidator(createRoomSchema),
        joinRoom: createValidator(joinRoomSchema),
        updateGameSettings: createValidator(updateGameSettingsSchema),
        takeFromCenter: createValidator(takeFromCenterSchema),
        takeFromPlayer: createValidator(takeFromPlayerSchema),
        exchangeWithCenter: createValidator(exchangeWithCenterSchema),
        exchangeWithPlayer: createValidator(exchangeWithPlayerSchema),
        pass: createValidator(passSchema),
        showdownConfirm: createValidator(showdownConfirmSchema),
        chatMessage: createValidator(chatMessageSchema)
    },

    // 범용 검증 헬퍼
    validateData: (schema, data) => {
        return createValidator(schema)(data);
    }
};
