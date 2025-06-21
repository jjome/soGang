# soGang - 멀티플레이어 게임

웹 기반 멀티플레이어 숫자 맞추기 게임입니다. 사용자들은 로그인 후 로비에서 방을 만들거나 참가하여 실시간으로 게임을 즐길 수 있습니다.

## 주요 기능

- **사용자 관리**: 회원가입, 로그인, 로그아웃
- **암구호 시스템**: 관리자가 설정한 암구호를 입력해야 로그인 가능
- **로비 시스템**: 여러 방을 만들고 참가할 수 있는 로비
- **실시간 게임**: Socket.IO를 사용한 실시간 멀티플레이어 게임
- **관리자 기능**: 사용자 목록 조회, 암구호 변경

## 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **Real-time**: Socket.IO
- **Authentication**: bcryptjs, express-session
- **Frontend**: HTML, CSS, JavaScript

## 설치 및 실행

### 로컬 환경

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **서버 실행**
   ```bash
   npm start
   ```

3. **브라우저에서 접속**
   ```
   http://localhost:3000
   ```

### Render 배포

1. **Git 저장소에 코드 푸시**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Render에서 새 Web Service 생성**
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **환경 변수 설정 (선택사항)**
   - `ADMIN_PASSWORD`: 관리자 비밀번호 (기본값: 'admin')

## 게임 규칙

1. **방 참가**: 로비에서 방을 만들거나 기존 방에 참가
2. **준비**: 모든 플레이어가 '준비' 버튼을 눌러야 게임 시작
3. **게임 진행**: 1-100 사이의 숫자를 추측하여 정답을 맞추기
4. **점수**: 정답을 맞추면 10점 획득

## 관리자 기능

- **관리자 로그인**: `/admin` 페이지에서 관리자 비밀번호로 로그인
- **암구호 변경**: 새로운 암구호 설정
- **사용자 목록**: 등록된 모든 사용자와 점수 조회

## 기본 설정

- **기본 암구호**: `1234`
- **관리자 비밀번호**: `admin`
- **포트**: `3000` (환경변수 `PORT`로 변경 가능)

## 파일 구조

```
soGang/
├── index.js              # 메인 서버 파일
├── database.js           # 데이터베이스 연결 및 쿼리
├── socketHandlers.js     # 실시간 통신 핸들러
├── package.json          # 프로젝트 설정 및 의존성
├── .gitignore           # Git 무시 파일 목록
├── README.md            # 프로젝트 설명서
└── public/              # 정적 파일
    ├── login.html       # 로그인/회원가입 페이지
    ├── game.html        # 게임 로비 및 게임 페이지
    ├── game-client.js   # 게임 클라이언트 로직
    └── admin.html       # 관리자 페이지
```

## 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 