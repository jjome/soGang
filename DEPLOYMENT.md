# 🚀 배포 가이드

## 환경 변수 설정

배포 환경에서는 다음 환경 변수를 설정하세요:

```bash
# 필수 환경 변수
NODE_ENV=production
PORT=3000  # 또는 원하는 포트

# 보안을 위한 환경 변수 (권장)
ADMIN_PASSWORD=your-secure-admin-password
SESSION_SECRET=your-secure-session-secret

# 선택적 환경 변수
# SESSION_SECRET이 설정되지 않으면 기본값 사용
```

## 배포 플랫폼별 설정

### Render (추천)
```bash
# Render 대시보드에서 환경 변수 설정
NODE_ENV=production
ADMIN_PASSWORD=your-secure-admin-password
SESSION_SECRET=your-secure-session-secret

# Build Command (선택사항)
npm install

# Start Command
npm start
```

### Heroku
```bash
# 환경 변수 설정
heroku config:set NODE_ENV=production
heroku config:set ADMIN_PASSWORD=your-secure-password
heroku config:set SESSION_SECRET=your-secure-session-secret

# 배포
git push heroku main
```

### Railway
```bash
# Railway 대시보드에서 환경 변수 설정
NODE_ENV=production
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-secure-session-secret
```

### Vercel
```bash
# vercel.json 설정
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 일반 서버 (Ubuntu/CentOS)
```bash
# PM2 사용 예시
npm install -g pm2
pm2 start index.js --name sogang-app
pm2 startup
pm2 save
```

## 주의사항

1. **보안**: 프로덕션에서는 반드시 `ADMIN_PASSWORD`와 `SESSION_SECRET`을 설정하세요
2. **HTTPS**: 프로덕션에서는 HTTPS를 사용해야 세션이 제대로 작동합니다
3. **데이터베이스**: SQLite 파일이 서버에 저장되므로 백업을 정기적으로 수행하세요
4. **포트**: `PORT` 환경 변수를 통해 포트를 설정할 수 있습니다

## 개발 vs 프로덕션

- **개발**: `npm run dev` (nodemon 사용)
- **프로덕션**: `npm start` (cross-env로 NODE_ENV=production 설정) 