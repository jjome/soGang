// 인증 미들웨어
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        // API 요청인 경우 JSON 에러 반환
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        // 페이지 요청인 경우 리다이렉트
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