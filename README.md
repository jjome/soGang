# 소강 게임 프로젝트

## 🎯 프로젝트 개요

소강 게임은 멀티플레이어 포커 게임을 위한 웹 애플리케이션입니다. 실시간 게임 플레이와 함께 사용자의 게임 통계와 상태를 체계적으로 관리합니다.

## 🚀 주요 기능

- **실시간 멀티플레이어 게임**: Socket.io를 활용한 실시간 포커 게임
- **사용자 인증 시스템**: 회원가입, 로그인, 세션 관리
- **게임 데이터 영속화**: 모든 게임 데이터를 데이터베이스에 저장
- **사용자 상태 관리**: 10개의 장점/단점 상태와 레벨 시스템
- **통계 및 업적 시스템**: 게임 통계, 승률, 칩 변화 등 추적
- **관리자 기능**: 게임 모니터링 및 사용자 관리

## 🏗️ 아키텍처

### 백엔드 구조
```
src/
├── app.js              # Express 앱 설정
├── config/             # 설정 파일들
├── controllers/        # API 컨트롤러
│   ├── authController.js    # 인증 관련
│   ├── gameController.js    # 게임 관련
│   ├── userController.js    # 유저 상태 관련
│   └── adminController.js   # 관리자 기능
├── routes/             # API 라우트
│   ├── auth.js         # 인증 라우트
│   ├── games.js        # 게임 라우트
│   ├── users.js        # 유저 라우트
│   └── admin.js        # 관리자 라우트
├── middleware/          # 미들웨어
└── websocket/          # WebSocket 핸들러
```

### 데이터베이스 스키마

#### 핵심 테이블들
- **users**: 사용자 기본 정보
- **games**: 게임 세션 정보
- **game_players**: 게임 참가자 정보
- **game_rounds**: 게임 라운드 정보
- **player_rounds**: 플레이어별 라운드 상태
- **player_actions**: 플레이어 액션 기록

#### 사용자 상태 테이블들
- **user_stats**: 게임 통계 (승률, 칩 변화 등)
- **user_adv_status**: 장점 상태 10개 (레벨 1-5)
- **user_dis_status**: 단점 상태 10개 (레벨 1-5)

## 📡 API 엔드포인트

### 인증 API (`/api`)
- `POST /register` - 회원가입
- `POST /login` - 로그인
- `POST /logout` - 로그아웃
- `GET /user` - 사용자 정보 조회
- `POST /change-password` - 비밀번호 변경

### 게임 API (`/api/games`)
- `GET /` - 게임 목록 조회
- `POST /` - 새 게임 생성
- `GET /:id` - 특정 게임 정보
- `PUT /:id/start` - 게임 시작
- `PUT /:id/end` - 게임 종료
- `GET /:id/players` - 게임 플레이어 목록
- `POST /:id/players` - 게임에 플레이어 추가
- `GET /:id/rounds` - 게임 라운드 목록
- `POST /:id/rounds` - 새 라운드 생성
- `GET /:id/actions` - 게임 액션 기록
- `POST /:id/actions` - 게임 액션 기록
- `GET /:id/statistics` - 게임 통계

### 유저 상태 API (`/api/users/:username`)
- `GET /stats` - 유저 통계 조회
- `PUT /stats` - 유저 통계 업데이트
- `GET /adv-status` - 장점 상태 조회
- `PUT /adv-status` - 장점 상태 업데이트
- `GET /dis-status` - 단점 상태 조회
- `PUT /dis-status` - 단점 상태 업데이트
- `GET /games` - 게임 히스토리
- `GET /achievements` - 업적 조회

### 관리자 API (`/api/admin`)
- `GET /users` - 모든 사용자 목록
- `POST /users/:id/delete` - 사용자 삭제
- `PUT /access-code` - 암구호 변경
- `PUT /admin-password` - 관리자 비밀번호 변경

## 🎮 게임 시스템

### 게임 진행
1. **게임 생성**: 호스트가 게임을 생성하고 설정
2. **플레이어 참가**: 최대 6명까지 참가 가능
3. **게임 시작**: 호스트가 게임을 시작
4. **라운드 진행**: 4라운드로 구성 (preflop, flop, turn, river)
5. **게임 종료**: 최종 승자 결정 및 통계 업데이트

### 사용자 상태 시스템
- **장점 상태 10개**: 공격적 플레이, 블러프 마스터, 포지션 활용 등
- **단점 상태 10개**: 과도한 베팅, 감정적 플레이, 포지션 무시 등
- **레벨 시스템**: 각 상태별 1-5 레벨
- **포인트 시스템**: 게임 플레이에 따른 포인트 적립

## 🛠️ 설치 및 실행

### 요구사항
- Node.js 18.0.0 이상
- SQLite3

### 설치
```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm start
```

### 환경 설정
- `NODE_ENV`: 실행 환경 (development/production)
- `PORT`: 서버 포트 (기본값: 3000)

## 🧪 테스트

API 테스트를 위한 전용 페이지가 제공됩니다:
- `/api-test.html` - 모든 API 엔드포인트 테스트 가능

## 📊 데이터 백업

- 자동 데이터베이스 백업 시스템
- 서버 시작 시 백업에서 복원 시도
- 서버 종료 시 자동 백업 수행

## 🔒 보안 기능

- 세션 기반 인증
- 비밀번호 해싱 (bcrypt)
- 관리자 권한 시스템
- 암구호 시스템

## 🚧 개발 중인 기능

- [ ] 게임 리플레이 시스템
- [ ] 고급 통계 분석
- [ ] 리더보드 시스템
- [ ] 토너먼트 모드
- [ ] 모바일 최적화

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요. 