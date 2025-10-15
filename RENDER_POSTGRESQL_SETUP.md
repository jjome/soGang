# Render PostgreSQL 설정 가이드

## 📋 목차
1. [PostgreSQL 데이터베이스 생성](#1-postgresql-데이터베이스-생성)
2. [연결 정보 확인](#2-연결-정보-확인)
3. [Web Service 생성 및 연결](#3-web-service-생성-및-연결)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [배포 및 확인](#5-배포-및-확인)
6. [문제 해결](#6-문제-해결)

---

## 1. PostgreSQL 데이터베이스 생성

### Step 1: Render Dashboard 접속
1. https://dashboard.render.com 접속
2. 로그인 (GitHub, GitLab, Google 계정으로 가능)

### Step 2: PostgreSQL 생성
1. Dashboard 좌측 상단 **"New +"** 버튼 클릭
2. **"PostgreSQL"** 선택

![New PostgreSQL](https://docs.render.com/images/new-postgres.png)

### Step 3: 데이터베이스 설정

#### 기본 정보 입력:
```
Name: sogang-db
  (또는 원하는 이름)

Database: sogang
  (실제 데이터베이스 이름)

User: sogang_user
  (자동 생성됨, 변경 가능)

Region: Oregon (US West)
  (한국에서 가까운 지역 선택 권장)

PostgreSQL Version: 16
  (최신 버전 권장)
```

#### 플랜 선택:
- **Free Plan** 선택
  - 0 GB disk (메모리 기반)
  - 90일 후 만료 (재생성 가능)
  - 개발/테스트용으로 적합

또는

- **Starter Plan ($7/월)** 선택
  - 영구 사용 가능
  - 1 GB disk
  - 프로덕션 환경 권장

### Step 4: Create Database
- 하단의 **"Create Database"** 버튼 클릭
- 생성까지 약 1-2분 소요

---

## 2. 연결 정보 확인

### Step 1: 데이터베이스 페이지 접속
생성된 PostgreSQL 데이터베이스 클릭

### Step 2: 연결 정보 확인
**"Connections"** 섹션에서 다음 정보 확인:

#### Internal Database URL (권장)
```
postgres://user:password@dpg-xxxxx-a.oregon-postgres.render.com/database_name
```

**중요**:
- **External** URL이 아닌 **Internal** URL 사용
- Internal URL은 Render 내부 네트워크에서만 작동 (더 빠름)
- External URL은 외부에서 접속 가능 (개발 시 사용)

#### 개별 연결 정보
```
Host: dpg-xxxxx-a.oregon-postgres.render.com
Database: sogang
Port: 5432
Username: sogang_user
Password: [자동 생성된 비밀번호]
```

### Step 3: 연결 정보 복사
- **Internal Database URL** 전체를 복사해두세요
- 또는 각 필드(Host, Database, Username, Password)를 따로 복사

---

## 3. Web Service 생성 및 연결

### Step 1: Web Service 생성
1. Dashboard 좌측 상단 **"New +"** 버튼 클릭
2. **"Web Service"** 선택

### Step 2: GitHub 저장소 연결
1. **"Build and deploy from a Git repository"** 선택
2. **"Connect account"** → GitHub 계정 연결
3. 원하는 저장소 선택 (예: `soGang`)
4. **"Connect"** 클릭

### Step 3: Web Service 설정

#### 기본 정보:
```
Name: sogang-game
  (원하는 이름)

Region: Oregon (US West)
  (PostgreSQL과 같은 지역 선택!)

Branch: main
  (또는 master)

Root Directory: (비워두기)
  (루트 디렉토리가 아니라면 경로 지정)
```

#### 빌드 설정:
```
Build Command:
  npm install

Start Command:
  npm start
```

#### 플랜 선택:
- **Free Plan** 선택
  - 750시간/월 무료
  - 15분 비활성 시 슬립 모드
  - 개발/테스트용

또는

- **Starter Plan ($7/월)** 선택
  - 슬립 없음
  - 프로덕션 환경 권장

---

## 4. 환경 변수 설정

### Step 1: Environment 섹션 찾기
Web Service 설정 페이지에서 **"Environment"** 섹션으로 이동

### Step 2: 환경 변수 추가

#### 방법 1: Internal Database URL 사용 (권장)

**단점**: 현재 코드가 DATABASE_URL을 지원하지 않음

```env
NODE_ENV=production
PORT=10000

# PostgreSQL 연결 (Internal URL에서 추출)
DATABASE_URL=postgres://sogang_user:password@dpg-xxxxx-a.oregon-postgres.render.com/sogang

# 세션 보안
SESSION_SECRET=your-super-strong-random-secret-key-here-at-least-32-chars

# 관리자 초기 비밀번호
ADMIN_PASSWORD=your-secure-admin-password

# CORS 설정 (자신의 Render URL로 변경)
ALLOWED_ORIGINS=https://sogang-game.onrender.com

# 로깅
LOG_LEVEL=info
```

#### 방법 2: 개별 필드 사용 (현재 코드에 맞음) ✅

```env
NODE_ENV=production
PORT=10000

# PostgreSQL 연결 정보 (Render PostgreSQL에서 복사)
DB_HOST=dpg-xxxxx-a.oregon-postgres.render.com
DB_PORT=5432
DB_NAME=sogang
DB_USER=sogang_user
DB_PASSWORD=복사한_비밀번호_붙여넣기

# 세션 보안 키 (강력한 랜덤 문자열)
SESSION_SECRET=aB3$xY9#mK2@pQ7&wR5!nL8^tF4*hJ6+

# 관리자 초기 비밀번호
ADMIN_PASSWORD=Admin123!Secure

# CORS 설정
ALLOWED_ORIGINS=https://sogang-game.onrender.com

# 로깅 레벨
LOG_LEVEL=info
```

### Step 3: 환경 변수 입력 방법

#### 개별 추가:
1. **"Add Environment Variable"** 클릭
2. Key와 Value 입력
3. 모든 변수를 하나씩 추가

#### 일괄 추가:
1. **"Add from .env"** 클릭
2. 위 환경 변수를 모두 복사해서 붙여넣기
3. **"Save"** 클릭

### Step 4: 중요한 환경 변수 설명

| 환경 변수 | 설명 | 예시 |
|----------|------|------|
| `NODE_ENV` | 실행 환경 | `production` |
| `DB_HOST` | PostgreSQL 호스트 | `dpg-xxxxx-a.oregon-postgres.render.com` |
| `DB_PORT` | PostgreSQL 포트 | `5432` |
| `DB_NAME` | 데이터베이스 이름 | `sogang` |
| `DB_USER` | 사용자 이름 | `sogang_user` |
| `DB_PASSWORD` | 비밀번호 | Render에서 자동 생성된 것 |
| `SESSION_SECRET` | 세션 암호화 키 | 32자 이상 랜덤 문자열 |
| `ADMIN_PASSWORD` | 관리자 초기 비밀번호 | 강력한 비밀번호 |
| `ALLOWED_ORIGINS` | CORS 허용 도메인 | `https://your-app.onrender.com` |

---

## 5. 배포 및 확인

### Step 1: 배포 시작
1. 모든 설정 완료 후 **"Create Web Service"** 클릭
2. 자동으로 빌드 및 배포 시작

### Step 2: 배포 로그 확인
- **"Logs"** 탭에서 실시간 로그 확인
- 성공 메시지 확인:
```
PostgreSQL 데이터베이스에 성공적으로 연결되었습니다.
데이터베이스 테이블이 성공적으로 준비되었습니다.
서버가 http://0.0.0.0:10000 에서 실행 중입니다.
```

### Step 3: 배포 완료
- 상태가 **"Live"**로 변경되면 배포 완료
- 상단에 표시된 URL 클릭하여 접속
  - 예: `https://sogang-game.onrender.com`

### Step 4: 기능 테스트
1. ✅ 회원가입 테스트
2. ✅ 로그인 테스트
3. ✅ 관리자 로그인 테스트
4. ✅ 게임 시작 테스트
5. ✅ 데이터 저장/불러오기 테스트

---

## 6. 문제 해결

### 문제 1: 데이터베이스 연결 실패
```
Error: connect ECONNREFUSED
```

**해결 방법:**
1. Logs 탭에서 정확한 에러 확인
2. 환경 변수가 올바르게 설정되었는지 확인
3. DB_HOST, DB_PASSWORD가 정확한지 재확인
4. PostgreSQL이 같은 지역(Region)에 있는지 확인

**확인 방법:**
```bash
# Render Shell 탭에서 실행
echo $DB_HOST
echo $DB_PORT
echo $DB_NAME
```

---

### 문제 2: 세션 오류
```
Error: SESSION_SECRET must be set
```

**해결 방법:**
1. Environment 탭 확인
2. `SESSION_SECRET` 변수가 추가되어 있는지 확인
3. 변수 추가 후 **"Manual Deploy"** → **"Deploy latest commit"** 클릭

---

### 문제 3: 서버가 시작되지 않음
```
Error: Cannot find module 'pg'
```

**해결 방법:**
1. `package.json`에 `pg` 패키지가 있는지 확인
2. GitHub에 push되었는지 확인
3. Render에서 다시 배포

```bash
# 로컬에서 확인
npm list pg

# 없으면 설치
npm install pg
git add package.json package-lock.json
git commit -m "Add pg dependency"
git push
```

---

### 문제 4: 게임 시작 오류 (Foreign Key)
```
Foreign key constraint violation
```

**해결 방법:**
- 이미 수정 완료됨 (database.js 수정)
- 최신 코드를 GitHub에 push했는지 확인
- Render에서 자동 재배포 대기 또는 수동 배포

---

### 문제 5: 90일 후 무료 PostgreSQL 만료

**해결 방법:**
1. Render Dashboard → PostgreSQL 선택
2. **"Delete Database"** (데이터 백업 후)
3. 새로운 Free PostgreSQL 생성
4. Web Service 환경 변수 업데이트
5. 다시 배포

**데이터 백업 방법:**
```bash
# 로컬에서 pg_dump 사용
pg_dump -h dpg-xxxxx-a.oregon-postgres.render.com \
  -U sogang_user \
  -d sogang \
  -f backup.sql

# 새 데이터베이스에 복원
psql -h dpg-yyyyy-a.oregon-postgres.render.com \
  -U sogang_user \
  -d sogang \
  -f backup.sql
```

---

## 📌 추가 팁

### 1. 로컬에서 Render PostgreSQL 연결 테스트
```javascript
// test-connection.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('연결 실패:', err);
    } else {
        console.log('연결 성공:', res.rows[0]);
    }
    pool.end();
});
```

```bash
node test-connection.js
```

### 2. Render Shell에서 데이터베이스 확인
1. Web Service → **"Shell"** 탭
2. 명령어 실행:
```bash
# 환경 변수 확인
printenv | grep DB_

# PostgreSQL 연결 테스트
psql $DATABASE_URL -c "SELECT version();"
```

### 3. 성능 모니터링
- **"Metrics"** 탭에서 CPU, 메모리 사용량 확인
- 무료 플랜은 512MB RAM 제한
- 메모리 초과 시 서버 재시작될 수 있음

### 4. 자동 배포 설정
- Settings → **"Auto-Deploy"** 활성화
- GitHub에 push하면 자동으로 Render에 배포됨

---

## ✅ 체크리스트

배포 전 확인사항:

- [ ] PostgreSQL 데이터베이스 생성 완료
- [ ] Internal Database URL 복사 완료
- [ ] Web Service 생성 완료
- [ ] 환경 변수 11개 모두 설정 완료
- [ ] 같은 Region 선택 (PostgreSQL과 Web Service)
- [ ] GitHub 최신 코드 push 완료
- [ ] `pg` 패키지 설치 및 package.json에 포함
- [ ] SESSION_SECRET 강력한 랜덤 문자열로 설정
- [ ] ADMIN_PASSWORD 보안 비밀번호로 설정

배포 후 확인사항:

- [ ] 서버 상태 "Live" 확인
- [ ] 로그에서 "PostgreSQL 연결 성공" 메시지 확인
- [ ] URL 접속 가능 확인
- [ ] 회원가입/로그인 동작 확인
- [ ] 관리자 로그인 동작 확인
- [ ] 게임 시작 동작 확인

---

## 📞 도움이 필요하신가요?

- Render 공식 문서: https://docs.render.com/databases
- PostgreSQL 가이드: https://docs.render.com/postgresql
- 커뮤니티: https://community.render.com

---

**작성일**: 2025-10-16
**버전**: v1.0
