# Waboranggae App 보안 설계 (Security Design)

## 📋 목차
1. [보안 위협 분석](#보안-위협-분석)
2. [인증 시스템 (JWT)](#인증-시스템-jwt)
3. [비밀번호 관리](#비밀번호-관리)
4. [API 보안](#api-보안)
5. [데이터 보안](#데이터-보안)
6. [배포 보안](#배포-보안)
7. [체크리스트](#체크리스트)

---

## 보안 위협 분석

### 현재 문제점

| 위협 | 심각도 | 현재 상태 |
|---|---|---|
| **Authentication** | 🔴 높음 | x-user-id 헤더로 전달 (위변조 가능) |
| **Password** | 🔴 높음 | 비밀번호 저장 안 함 |
| **Authorization** | 🟡 중간 | 사용자 ID 검증 안 함 |
| **CORS** | 🟡 중간 | 모두 허용 |
| **SQL Injection** | 🟢 낮음 | Prisma 사용 (자동 방어) |
| **XSS** | 🟢 낮음 | React Native (브라우저 아님) |
| **Data Exposure** | 🟡 중간 | 민감 정보 검증 부족 |
| **Rate Limiting** | 🟡 중간 | 미구현 |

---

## 인증 시스템 (JWT)

### 개요

JWT (JSON Web Tokens)를 사용한 토큰 기반 인증:
- **Access Token** - 짧은 유효기간 (15분)
- **Refresh Token** - 긴 유효기간 (7일)
- **Stateless** - 서버에서 토큰 저장 안 함

### 흐름도

```
[모바일 앱]                    [백엔드 서버]              [PostgreSQL]

1. 회원가입/로그인
   email + password ────────────→ POST /auth/login
                                      ↓ bcrypt 검증
                                      ↓ JWT 생성
                      ←────────── {accessToken, refreshToken, user}

2. API 요청
   GET /api/user/bookmarks
   Authorization: Bearer {accessToken}
                ────────────→ JWT 검증 (middleware)
                             ↓ userId 추출
                             ↓ DB 조회
                      ←────────── {bookmarks: [...]}

3. 토큰 만료 → 갱신
   POST /auth/refresh
   {refreshToken}  ────────────→ Refresh 검증
                                      ↓ 새 AccessToken 생성
                      ←────────── {accessToken}
```

### 구현 구조

```
server/src/
├── auth/
│   ├── jwt.ts                 ✅ JWT 생성/검증
│   └── routes.ts              ✅ /auth/login, /auth/refresh
├── middleware/
│   ├── auth.ts                ✅ JWT 검증 미들웨어
│   └── error.ts               ✅ 에러 핸들러
└── utils/
    └── crypto.ts              ✅ bcrypt 해싱
```

### API 엔드포인트

| 엔드포인트 | 메서드 | 인증 | 설명 |
|---|---|---|---|
| `/auth/signup` | POST | ❌ | 회원가입 |
| `/auth/login` | POST | ❌ | 로그인 |
| `/auth/refresh` | POST | ❌ | 토큰 갱신 |
| `/auth/logout` | POST | ✅ | 로그아웃 |
| `/api/user/*` | * | ✅ | 사용자 관련 (인증 필요) |

### 토큰 구조

```typescript
// Access Token (JWT payload)
{
  userId: "uuid",
  email: "user@example.com",
  iat: 1234567890,           // 발급 시간
  exp: 1234569690,           // 만료 시간 (15분)
}

// Refresh Token (JWT payload)
{
  userId: "uuid",
  tokenVersion: 1,           // 토큰 무효화용
  iat: 1234567890,
  exp: 1234912490,           // 7일
}
```

---

## 비밀번호 관리

### 저장 방식

**절대로 평문 저장 금지!** bcrypt로 해싱:

```typescript
import bcrypt from 'bcrypt';

// 회원가입 시
const password = req.body.password;
const hashedPassword = await bcrypt.hash(password, 10); // salt rounds: 10
await prisma.user.create({
  data: {
    email,
    displayName,
    password: hashedPassword,  // ← 해싱된 비밀번호 저장
  }
});

// 로그인 시
const user = await prisma.user.findUnique({ where: { email } });
const isValid = await bcrypt.compare(password, user.password);
if (!isValid) throw new Error('비밀번호 불일치');
```

### 보안 요구사항

- ✅ 최소 8자 이상
- ✅ 대문자 + 소문자 + 숫자 + 특수문자 포함
- ✅ 이전 비밀번호와 다를 것
- ✅ 시간 제한으로 brute force 방지

### 비밀번호 정책

```typescript
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /\d/,
  special: /[!@#$%^&*]/,
};

function validatePassword(password: string): string | null {
  if (password.length < 8) return '최소 8자 이상';
  if (!PASSWORD_REQUIREMENTS.uppercase.test(password)) return '대문자 포함 필요';
  if (!PASSWORD_REQUIREMENTS.lowercase.test(password)) return '소문자 포함 필요';
  if (!PASSWORD_REQUIREMENTS.digit.test(password)) return '숫자 포함 필요';
  if (!PASSWORD_REQUIREMENTS.special.test(password)) return '특수문자 포함 필요';
  return null;
}
```

---

## API 보안

### 1. CORS (Cross-Origin Resource Sharing)

**현재:** 모두 허용 ❌
**개선:** 특정 도메인만 허용

```typescript
// server/index.ts
import cors from 'cors';

const ALLOWED_ORIGINS = [
  'http://localhost:8081',           // 개발 (Expo)
  'https://app.waboranggae.com',     // 운영 (모바일)
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,                  // 쿠키/인증 헤더 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,                     // 24시간 캐싱
}));
```

### 2. Rate Limiting

**목적:** Brute force 공격, DDoS 방지

```typescript
// server/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// 일반 API 요청
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 100,                   // 15분당 100 요청
  message: '너무 많은 요청',
});

// 로그인 시도
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                     // 15분당 5회 시도만 가능
  skipSuccessfulRequests: true,
  message: '너무 많은 로그인 시도. 15분 후 다시 시도하세요.',
});

// 사용 예
app.post('/auth/login', loginLimiter, loginHandler);
app.use('/api/', apiLimiter);
```

### 3. Input Validation

**목적:** 인젝션 공격, 잘못된 데이터 방지

```typescript
// server/src/schemas/auth.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소'),
  password: z.string().min(8, '비밀번호는 8자 이상'),
});

export const signupSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(50),
  password: z.string().min(8).regex(
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/,
    '대소문자, 숫자, 특수문자 포함 필요'
  ),
});

// 사용 예
app.post('/auth/login', (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    // 검증 완료
  } catch (err) {
    res.status(400).json({ error: err.issues[0].message });
  }
});
```

### 4. SQL Injection 방지

**현재:** Prisma ORM 사용 (자동 방어) ✅
**추가:** 쿼리 매개변수 검증

```typescript
// ✅ 안전 (Prisma)
await prisma.user.findUnique({
  where: { email: userInput }, // 자동으로 이스케이프
});

// ❌ 위험 (raw SQL 사용 시)
// const result = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
```

### 5. 에러 메시지 보안

**목적:** 시스템 정보 노출 방지

```typescript
// ❌ 위험
res.status(500).json({
  error: 'Database connection failed',
  details: err.message,  // 스택 추적 노출
});

// ✅ 안전
res.status(500).json({
  error: 'Something went wrong. Please try again later.',
  // (개발 환경에서만 details 노출)
  ...(process.env.NODE_ENV === 'development' && { details: err.message }),
});
```

---

## 데이터 보안

### 1. 민감 정보 필터링

```typescript
// user.ts 쿼리에서
export class UserQueries {
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    // 암호 필드 제거 (절대 클라이언트에 전송 금지)
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
```

### 2. 데이터 암호화 (선택사항)

중요한 정보는 암호화 저장:

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32바이트

function encryptField(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptField(encrypted: string): string {
  const [iv, encryptedText] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}
```

### 3. 접근 제어 (Authorization)

```typescript
// 자신의 정보만 조회 가능
app.get('/api/user/me', authenticateToken, (req, res) => {
  const userId = req.user.userId;  // JWT에서 추출
  
  // req.body.userId와 JWT의 userId가 일치하는지 검증
  if (req.query.userId && req.query.userId !== userId) {
    return res.status(403).json({ error: '권한 없음' });
  }
  
  // 해당 사용자 정보 조회
  const user = await UserQueries.getUserById(userId);
  res.json(user);
});
```

---

## 배포 보안

### 1. 환경변수 관리

```bash
# .env.local (개발)
JWT_SECRET=your-dev-secret-here
JWT_REFRESH_SECRET=your-dev-refresh-secret
DATABASE_URL=postgresql://user:pass@localhost:5432/waboranggae

# .env.production (배포)
JWT_SECRET=${SECRET_JWT_SECRET}        # 외부 비밀 저장소에서 로드
JWT_REFRESH_SECRET=${SECRET_JWT_REFRESH}
DATABASE_URL=${SECRET_DATABASE_URL}
```

**절대 금지:**
- ❌ 비밀키를 git에 커밋
- ❌ 환경변수를 코드에 하드코딩
- ❌ 비밀번호를 평문으로 저장

### 2. HTTPS/SSL

모든 배포 환경에서 HTTPS 필수:

```typescript
// Express에서 HTTPS 강제
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});
```

### 3. 보안 헤더

```typescript
import helmet from 'helmet';

app.use(helmet()); // 기본 보안 헤더 추가

// 커스텀 헤더
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

### 4. 로깅 & 모니터링

```typescript
// 의심한 활동 로그
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// 사용 예
logger.warn('Failed login attempt', {
  email,
  ip: req.ip,
  timestamp: new Date(),
});
```

---

## 체크리스트

### Phase 1: 기본 인증 (필수)

- [ ] Prisma 스키마에 password 필드 추가
- [ ] bcrypt로 비밀번호 해싱
- [ ] JWT 생성/검증 함수 구현
- [ ] 로그인 엔드포인트 `/auth/login`
- [ ] 회원가입 엔드포인트 `/auth/signup`
- [ ] 토큰 검증 미들웨어
- [ ] API 클라이언트에서 JWT 저장/사용
- [ ] useUser hook JWT 통합

### Phase 2: API 보안 (권장)

- [ ] CORS 정책 제한
- [ ] Rate Limiting 적용
- [ ] Input Validation (Zod)
- [ ] 에러 메시지 보안화
- [ ] 민감 정보 필터링
- [ ] 접근 제어 (Authorization)

### Phase 3: 배포 준비 (권장)

- [ ] 환경변수 외부 관리
- [ ] HTTPS/SSL 설정
- [ ] 보안 헤더 추가 (Helmet)
- [ ] 로깅 & 모니터링 (Winston/Sentry)
- [ ] 보안 감사 (Snyk, npm audit)

### Phase 4: 심화 보안 (선택)

- [ ] MFA (Multi-Factor Authentication)
- [ ] 데이터 암호화 (AES-256)
- [ ] API 키 방식 인증
- [ ] OAuth2 (Google, Apple)
- [ ] 침입 탐지 시스템

---

## 추천 패키지

```json
{
  "bcrypt": "^5.1.0",              // 비밀번호 해싱
  "jsonwebtoken": "^9.0.0",        // JWT
  "express-rate-limit": "^7.0.0",  // Rate limiting
  "helmet": "^7.0.0",              // 보안 헤더
  "zod": "^3.21.0",                // 입력 검증
  "winston": "^3.8.0",             // 로깅
  "@react-native-async-storage/async-storage": "^1.17.0", // 토큰 저장 (모바일)
}
```

---

## 보안 권장사항

### 개발 단계
1. 로컬 환경에서 테스트 (SQLite 사용 가능)
2. 약한 비밀번호도 허용 (테스트 용이)

### 스테이징 단계
1. PostgreSQL로 운영 환경과 동일
2. JWT 비밀키는 외부 저장소 사용
3. 보안 감사 (npm audit, Snyk)

### 프로덕션 단계
1. HTTPS/SSL 필수
2. 방화벽 설정 (IP 화이트리스팅)
3. 정기적 보안 패치
4. 접근 로그 모니터링
5. 정기적 보안 감사

---

## 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
- [bcrypt npm](https://www.npmjs.com/package/bcrypt)
- [jsonwebtoken npm](https://www.npmjs.com/package/jsonwebtoken)
