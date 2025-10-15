# Render 배포 가이드

## 현재 상황
- **데이터베이스**: SQLite (파일 기반)
- **문제**: Render의 파일 시스템은 임시(ephemeral)라서 재시작 시 데이터 손실

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

## 다음 단계

PostgreSQL로 전환하려면 알려주세요. 자동으로 코드를 변환해드리겠습니다!

필요한 것:
1. ✅ database.js 완전 재작성
2. ✅ 모든 SQL 쿼리 PostgreSQL 문법으로 변경
3. ✅ 환경 변수 설정 가이드
4. ✅ Render 배포 단계별 가이드
