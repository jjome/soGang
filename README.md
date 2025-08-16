# 🎮 소강 (Sogang Reborn)

멀티플레이어 게임 프로젝트의 새로운 시작

## 📋 프로젝트 개요

소강은 실시간 멀티플레이어 게임 플랫폼으로, 사용자들이 온라인으로 게임을 즐길 수 있는 웹 애플리케이션입니다. 현재 개발 중인 상태이며, 기본적인 게임 시스템과 사용자 관리 기능이 구현되어 있습니다.

## 🚀 현재 진행 상황

### ✅ 완료된 기능
- **사용자 인증 시스템**
  - 회원가입 및 로그인
  - 세션 기반 인증
  - 관리자 권한 관리
  
- **실시간 통신**
  - Socket.IO를 활용한 실시간 게임 통신
  - 사용자 온라인 상태 관리
  - 실시간 채팅 시스템
  
- **게임 방 시스템**
  - 게임 방 생성 및 참가
  - 방 목록 관리
  - 플레이어 관리
  
- **데이터베이스**
  - SQLite 데이터베이스 연동
  - 사용자 정보 및 게임 데이터 저장
  - 자동 백업 및 복원 시스템
  
- **관리자 기능**
  - 관리자 대시보드
  - 사용자 관리
  - 게임 모니터링

### 🔄 개발 중인 기능
- **게임 로직**
  - 카드 게임 시스템 (기본 구조 완성)
  - 게임 진행 단계 관리
  - 점수 시스템

#### 🎯 상세 구현 계획

**1. 카드 게임 시스템 (Card Game System)**
- **텍사스 홀덤 기반 카드 시스템**: 서버 중심 구현
- **데이터 구조**:
  - 카드: Suit(모양)와 Rank(숫자)를 가지는 객체
  - 덱: 52장 카드 배열, 피셔-예이츠 셔플 알고리즘 사용
- **카드 분배 로직**:
  - 개인 패: 각 플레이어에게 2장씩 비공개 분배
  - 공유 패: 5장의 커뮤니티 카드 (플랍 3장 + 턴 1장 + 리버 1장)
- **족보 판정 로직**:
  - 7장 중 5장 조합으로 최강 족보 계산
  - poker-evaluator 라이브러리 활용 권장

**2. 게임 진행 단계 관리 (Game State Management)**
- **게임 상태 정의**:
  - `WAITING`: 플레이어 준비 대기
  - `DEALING`: 카드 셔플 및 분배
  - `PREDICTING`: 패 순위 예측 단계 (제한 시간 있음)
  - `REVEALING`: 결과 공개 및 순위 비교
  - `ROUND_OVER`: 라운드 성공/실패 판정
  - `GAME_OVER`: 최종 승리/패배 결정
- **상태 흐름**: WAITING → DEALING → PREDICTING → REVEALING → ROUND_OVER → (DEALING 또는 GAME_OVER)

**3. 점수 시스템 (Scoring System)**
- **협력 게임 방식**: 경쟁이 아닌 팀 성공 여부 기록
- **라운드 성공/실패 판정**:
  - 예측 순위 배열과 실제 족보 순위 배열 비교
  - 완전 일치 시 성공, 불일치 시 실패
- **승리/패배 조건**:
  - 성공 3회 달성 시 승리
  - 실패 3회 달성 시 패배
- **개인 점수**: 승리 시 +10점, 패배 시 +1점 (선택사항)

### 📋 향후 계획
- 게임 완성도 향상
- 추가 게임 모드
- 모바일 최적화
- 성능 개선

## 🛠️ 기술 스택

### Backend
- **Node.js** - 서버 런타임
- **Express.js** - 웹 프레임워크
- **Socket.IO** - 실시간 통신
- **SQLite3** - 데이터베이스
- **bcryptjs** - 비밀번호 암호화
- **express-session** - 세션 관리

### Frontend
- **HTML5/CSS3** - 사용자 인터페이스
- **JavaScript (ES6+)** - 클라이언트 로직
- **Socket.IO Client** - 실시간 통신

### 개발 도구
- **Nodemon** - 개발 서버 자동 재시작
- **Cross-env** - 환경 변수 관리

## 📁 프로젝트 구조

```
soGang/
├── data/                   # 데이터베이스 파일
│   ├── sogang.db         # 메인 데이터베이스
│   └── sogang_backup.db  # 백업 데이터베이스
├── public/                # 정적 파일
│   ├── admin.html        # 관리자 페이지
│   ├── game.html         # 게임 페이지
│   ├── login.html        # 로그인 페이지
│   ├── index.html        # 메인 페이지
│   ├── style.css         # 스타일시트
│   └── game-client.js    # 게임 클라이언트 로직
├── src/                   # 소스 코드
│   ├── app.js            # Express 앱 설정
│   ├── config/           # 설정 파일
│   ├── controllers/      # 컨트롤러
│   ├── middleware/       # 미들웨어
│   └── routes/           # 라우트 정의
├── database.js           # 데이터베이스 설정 및 관리
├── socketHandlers.js     # Socket.IO 이벤트 핸들러
├── index.js              # 서버 진입점
└── package.json          # 프로젝트 의존성
```

## 🚀 설치 및 실행

### 필수 요구사항
- Node.js 18.0.0 이상
- npm 또는 yarn

### 설치 방법

1. **저장소 클론**
```bash
git clone [repository-url]
cd soGang
```

2. **의존성 설치**
```bash
npm install
```

3. **환경 변수 설정 (선택사항)**
```bash
# .env 파일 생성 또는 환경 변수 설정
NODE_ENV=development
PORT=3000
ADMIN_PASSWORD=your-admin-password
SESSION_SECRET=your-session-secret
```

4. **서버 실행**
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

5. **브라우저에서 접속**
```
http://localhost:3000
```

## 🎮 게임 플레이

### 기본 게임 플로우
1. **로그인/회원가입** - 게임 접속을 위한 계정 생성
2. **게임 방 입장** - 기존 방 참가 또는 새 방 생성
3. **게임 시작** - 방장이 게임을 시작하면 자동으로 게임 진행
4. **실시간 플레이** - 다른 플레이어들과 실시간으로 게임 진행

### 관리자 기능
- `/admin` 경로에서 관리자 대시보드 접근
- 사용자 관리 및 게임 모니터링
- 시스템 설정 관리

## 🔧 개발 가이드

### 개발 서버 실행
```bash
npm run dev
```

### 코드 구조
- **`index.js`**: 서버 진입점 및 기본 설정
- **`src/app.js`**: Express 앱 설정 및 미들웨어
- **`socketHandlers.js`**: 실시간 게임 로직 및 이벤트 처리
- **`database.js`**: 데이터베이스 연결 및 관리

### 주요 API 엔드포인트
- `POST /api/register` - 사용자 등록
- `POST /api/login` - 사용자 로그인
- `GET /api/admin/*` - 관리자 기능
- `GET /game` - 게임 페이지

## 📊 데이터베이스 스키마

### Users 테이블
- `id`: 사용자 고유 ID
- `username`: 사용자명 (고유)
- `password`: 암호화된 비밀번호
- `score`: 게임 점수

### Settings 테이블
- `key`: 설정 키
- `value`: 설정 값

## 🚀 배포

배포 관련 자세한 정보는 [DEPLOYMENT.md](./DEPLOYMENT.md) 파일을 참조하세요.

### 지원하는 배포 플랫폼
- Render (추천)
- Heroku
- Railway
- Vercel
- 일반 서버 (Ubuntu/CentOS)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 문의사항이나 버그 리포트는 이슈를 통해 제출해 주세요.

---

**소강 프로젝트** - 멀티플레이어 게임의 새로운 시작 🎮 