# soGang - 멀티플레이어 게임

로그인 기능이 있는 웹 기반 멀티플레이어 숫자 맞추기 게임입니다.

## 🎮 게임 특징

- **실시간 멀티플레이어**: Socket.IO를 사용한 실시간 게임
- **사용자 인증**: 로그인/회원가입 시스템
- **숫자 맞추기 게임**: 1-100 사이의 숫자를 맞추는 게임
- **점수 시스템**: 정답 시 점수 획득
- **플레이어 상태**: 준비/대기 상태 표시

## 🚀 Render 배포

### 1. GitHub에 코드 푸시
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin [your-github-repo-url]
git push -u origin main
```

### 2. Render에서 배포
1. [Render.com](https://render.com)에 로그인
2. "New +" → "Web Service" 클릭
3. GitHub 저장소 연결
4. 설정:
   - **Name**: soGang (또는 원하는 이름)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. 환경 변수 설정 (선택사항)
- `NODE_ENV`: production
- `PORT`: Render에서 자동 설정

## 🛠 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 서버 실행
npm start
```

## 📁 프로젝트 구조

```
soGang/
├── index.js          # 메인 서버 파일
├── package.json      # 프로젝트 설정
├── public/           # 정적 파일
│   ├── login.html    # 로그인 페이지
│   └── game.html     # 게임 페이지
└── README.md         # 프로젝트 설명
```

## 🎯 게임 규칙

1. 모든 플레이어가 "준비" 상태가 되면 게임 시작
2. 1-100 사이의 랜덤 숫자가 생성됨
3. 플레이어들이 번갈아가며 숫자를 추측
4. 정답을 맞추면 10점 획득
5. "새 라운드 시작" 버튼으로 계속 플레이 가능

## 🛡 보안

- 비밀번호는 bcrypt로 해시화
- 세션 기반 인증
- 입력 검증

## 🔧 기술 스택

- **백엔드**: Node.js, Express.js
- **실시간 통신**: Socket.IO
- **인증**: Express Session, bcryptjs
- **프론트엔드**: HTML5, CSS3, JavaScript
- **배포**: Render 