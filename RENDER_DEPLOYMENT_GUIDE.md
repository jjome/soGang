# Render 배포 가이드

## ✅ 완료 상태
- **데이터베이스**: PostgreSQL로 전환 완료
- **보안**: 환경변수 기반 비밀번호 관리 구현
- **UI**: 성공/실패 애니메이션 효과 추가

## Render 배포를 위한 데이터베이스 전환 방법

### 옵션 1: PostgreSQL 사용 (권장) ⭐

#### 장점
- ✅ Render에서 무료 PostgreSQL 제공 (512MB)
- ✅ 영구 데이터 저장
- ✅ 확장 가능
- ✅ 프로덕션 환경에 적합

#### 필요한 작업

**1. 패키지 설치**
```bash
npm install pg sequelize
```

**2. 데이터베이스 코드 수정**
`database.js`를 PostgreSQL용으로 변경:
- SQLite → PostgreSQL 쿼리 문법 변경
- `sqlite3` → `pg` 라이브러리 사용

**3. Render에서 PostgreSQL 데이터베이스 생성**
- Render 대시보드 → New → PostgreSQL
- 무료 플랜 선택 (512MB)
- Internal Database URL 복사

**4. 환경 변수 설정**
Render Web Service 환경 변수에 추가:
```
DATABASE_URL=postgres://[복사한 URL]
NODE_ENV=production
```

---

### 옵션 2: Render Disk 사용 (유료)

#### 장점
- ✅ 현재 SQLite 코드 그대로 사용 가능
- ✅ 파일 시스템 영구 저장

#### 단점
- ❌ 유료 ($0.25/GB/월)
- ❌ Render Disk는 최소 1GB부터 시작

#### 설정 방법
1. Render Web Service 설정
2. "Disks" 섹션에서 디스크 추가
3. Mount Path: `/data`
4. Size: 1GB

---

### 옵션 3: 외부 SQLite 호스팅 (권장하지 않음)

Turso, LiteFS Cloud 등의 서비스를 사용할 수 있지만:
- ❌ 복잡한 설정
- ❌ 무료 제한이 작음
- ❌ SQLite는 대규모 동시 접속에 부적합

---

## 권장 사항: PostgreSQL로 전환

### 단계별 가이드

#### Step 1: 패키지 설치
```bash
npm install pg
npm install --save-dev @types/pg  # TypeScript 사용 시
```

#### Step 2: 환경 변수 설정
`.env` 파일 생성:
```
DATABASE_URL=postgresql://username:password@localhost:5432/sogang
NODE_ENV=development
```

#### Step 3: database.js 수정 (예시)

**현재 (SQLite)**:
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/sogang.db');
```

**변경 후 (PostgreSQL)**:
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 쿼리 예시
pool.query('SELECT * FROM users WHERE username = $1', [username])
```

#### Step 4: 테이블 생성 쿼리 변경

**SQLite**:
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
)
```

**PostgreSQL**:
```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
)
```

#### Step 5: Render 배포
1. GitHub에 코드 푸시
2. Render → New → Web Service
3. GitHub 저장소 연결
4. PostgreSQL 데이터베이스 생성
5. 환경 변수 설정 (DATABASE_URL)
6. Deploy!

---

## 현재 데이터 마이그레이션

SQLite에서 PostgreSQL로 데이터를 옮기려면:

**방법 1: pgloader 사용**
```bash
pgloader sogang.db postgresql://[URL]
```

**방법 2: 수동 내보내기/가져오기**
1. SQLite에서 CSV로 내보내기
2. PostgreSQL에서 COPY 명령으로 가져오기

---

## 비용 비교

| 옵션 | 무료 제공량 | 비용 |
|------|-------------|------|
| PostgreSQL (Render) | 512MB | 무료 (90일 후 만료, 재생성 가능) |
| Render Disk | - | $0.25/GB/월 (최소 1GB) |
| 외부 호스팅 | 서비스별 상이 | 대부분 유료 |

---

## 추천 방법

**개발 중이고 사용자가 적다면**:
→ **PostgreSQL 무료 플랜** (권장)

**장기 운영 계획이라면**:
→ **PostgreSQL + Render 유료 플랜** ($7/월, 무료 DB 제한 없음)

**SQLite를 꼭 써야 한다면**:
→ **Render Disk** (1GB, $3/월)

---

## ✅ 완료된 작업

1. ✅ **database.js 완전 재작성** - SQLite에서 PostgreSQL로 전환
2. ✅ **모든 SQL 쿼리 PostgreSQL 문법으로 변경**
3. ✅ **환경 변수 설정** - `.env` 및 `.env.example` 업데이트
4. ✅ **보안 강화** - 하드코딩된 비밀번호 제거
5. ✅ **Git 보안** - 민감한 파일 `.gitignore`에 추가
6. ✅ **UI 개선** - 성공/실패 애니메이션 효과 추가

## Render 배포 방법

### 1️⃣ PostgreSQL 데이터베이스 생성
1. Render Dashboard → **New** → **PostgreSQL**
2. 무료 플랜 선택 (512MB)
3. **Internal Database URL** 복사

### 2️⃣ Web Service 생성
1. Render Dashboard → **New** → **Web Service**
2. GitHub 저장소 연결
3. 빌드 설정:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3️⃣ 환경 변수 설정
Web Service 설정에서 다음 환경 변수 추가:

```
NODE_ENV=production
PORT=10000

# PostgreSQL 연결 정보 (Render PostgreSQL에서 자동 제공)
DB_HOST=your-db-hostname.oregon-postgres.render.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# 세션 보안 키 (강력한 랜덤 문자열 생성)
SESSION_SECRET=your-super-secret-session-key-change-this

# 관리자 초기 비밀번호 (첫 실행 시 데이터베이스에 저장됨)
ADMIN_PASSWORD=your-initial-admin-password

# CORS 설정 (Render 도메인 추가)
ALLOWED_ORIGINS=https://your-app-name.onrender.com

# 로깅 레벨
LOG_LEVEL=info
```

### 4️⃣ 배포
- **Deploy** 버튼 클릭
- 빌드 및 배포 완료 대기 (약 2-5분)

### 5️⃣ 확인 사항
- ✅ 데이터베이스 연결 확인
- ✅ 관리자 로그인 테스트
- ✅ 회원가입/로그인 기능 테스트
- ✅ 게임 시작 테스트

---

## 🔒 보안 체크리스트

- ✅ `.env` 파일이 `.gitignore`에 포함되어 있음
- ✅ 하드코딩된 비밀번호 모두 제거됨
- ✅ 데이터베이스 파일 git 추적 제외됨
- ✅ 환경변수로 모든 민감 정보 관리
- ✅ 사용자 비밀번호 bcrypt로 해시 저장

---

## 🎨 새로운 기능

### 성공/실패 애니메이션 효과
쇼다운에서 성공/실패 시 시각적 효과 추가:

**성공 시:**
- 황금빛 펄스 애니메이션
- 행 전체 황금빛 글로우 효과
- 12개의 황금 코인이 원형으로 터지는 효과

**실패 시:**
- 빨간 점멸 애니메이션 (3회)
- 행 전체 어두워지는 효과
- 카드가 흑백으로 변하며 회전하는 효과

---

## 📝 추가 참고사항

### Render 무료 플랜 제한사항
- PostgreSQL: 90일 후 만료 (재생성 가능)
- 15분 동안 요청이 없으면 서버 슬립 모드
- 다음 요청 시 재시작 (약 30초-1분 소요)

### 유료 플랜 업그레이드 시 ($7/월)
- ✅ 서버 슬립 없음
- ✅ PostgreSQL 무제한
- ✅ 더 빠른 성능

---

## 문제 해결

### 데이터베이스 연결 오류
```
Error: connect ECONNREFUSED
```
→ 환경변수에서 `DB_HOST`, `DB_PORT`, `DB_PASSWORD` 확인

### 세션 오류
```
Error: SESSION_SECRET must be set
```
→ `SESSION_SECRET` 환경변수 추가

### 게임 시작 오류
```
Foreign key constraint violation
```
→ 데이터베이스 테이블이 제대로 생성되었는지 확인
