// 인증 미들웨어
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
};

// 관리자 권한 미들웨어
const requireAdmin = (req, res, next) => {
    console.log('관리자 API 접근 시 세션:', req.session);
    if (req.session.isAdmin) return next();
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
};

module.exports = {
    requireAuth,
    requireAdmin
}; 