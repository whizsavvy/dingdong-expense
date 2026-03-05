# dd-expense

수기로 입력하는 **웹 가계부** 앱.

> **폴더 이름을 영문으로 쓰려면**: 프로젝트 폴더를 `딩동가계부` → `dd-expense`로 바꾸면 터미널·배포 시 경로 문제를 줄일 수 있습니다. (Cursor 종료 → 탐색기에서 폴더 이름 변경 → `dd-expense` 폴더로 프로젝트 다시 열기) 배포하면 **주소 하나**로 PC·폰 어디서나 접속하고, **와이프와 실시간 동기화**됩니다.

## 특징

- **웹 주소 하나로 사용**: 로컬이 아니라 배포된 URL로 접속 → 둘 다 같은 주소만 쓰면 됨
- **실시간 동기화**: 한쪽에서 입력·삭제하면 다른 쪽 화면에 즉시 반영 (JSON 공유 불필요)
- 수입/지출 수동 입력, 카테고리·결제수단·사용처
- Supabase 설정 한 번이면 끝 (URL + 키 2개)

---

## 1. Supabase 설정 (한 번만 하면 됨)

### 1) 프로젝트 만들기

1. [supabase.com](https://supabase.com) 가입 후 로그인
2. **New Project** → 이름·비밀번호 입력 후 Create
3. 프로젝트가 준비될 때까지 1~2분 대기

### 2) API 값 복사

1. 왼쪽 메뉴 **Settings**(톱니바퀴) → **API**
2. **Project URL** 복사
3. **anon public** 키 복사 (긴 JWT 문자열)

### 3) 환경 변수 넣기

1. 이 프로젝트 폴더에 `.env` 파일 만들기
2. 아래처럼 넣기 (본인 URL·키로 교체)

```env
VITE_SUPABASE_URL=https://여기프로젝트ID.supabase.co
VITE_SUPABASE_ANON_KEY=여기에_anon_public_키_붙여넣기
```

### 4) 테이블 + 실시간 설정 (SQL 한 번에)

1. Supabase 대시보드 왼쪽 **SQL Editor**
2. **New query** 클릭
3. `supabase-setup.sql` 파일 내용 **전체** 복사해서 붙여넣기
4. **Run** 실행

이 SQL 안에 **실시간(Realtime)용 설정도 포함**돼 있어서, 실행만 하면 `transactions` 테이블이 자동으로 실시간 구독 대상에 들어갑니다.  
**대시보드에서 "Replication"이나 "Publications" 메뉴를 찾아서 테이블을 켤 필요 없어요.** (그 메뉴에 `transactions`가 안 보여도 괜찮습니다.)

- 마지막 줄에서 `"already in publication"` 같은 에러가 나면 → 이미 추가된 거라 **무시하고** 그대로 두면 됩니다.

---

## 2. 웹으로 배포하기 (필수 — 이 주소로 둘 다 접속)

로컬(localhost)은 내 PC에서만 보이므로, **웹에 배포**해서 공용 주소를 만듭니다.

### Vercel로 배포 (무료, 추천)

**방법 A — GitHub 연결 (추천)**  
1. 이 프로젝트를 **GitHub 저장소**로 올립니다 (예: `dd-expense` 레포 생성 후 push).  
2. [vercel.com](https://vercel.com) 접속 → **GitHub로 로그인** → **Add New…** → **Project**.  
3. 방금 올린 **저장소 선택** → **Import**.  
4. **Environment Variables**에 다음 두 개 추가:
   - `VITE_SUPABASE_URL` = (Supabase Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (Supabase anon public 키)  
   그다음 **Deploy** 클릭.  
5. 완료되면 **https://프로젝트명.vercel.app** 주소가 생깁니다. 이 주소로 접속하면 됩니다.

**방법 B — Vercel CLI (GitHub 없이)**  
1. 터미널에서 프로젝트 폴더로 이동한 뒤:
   ```bash
   npm i -g vercel
   vercel
   ```
2. 로그인 안내에 따라 진행하고, 배포가 끝나면 나온 **URL**로 접속.  
3. Supabase를 쓰려면 Vercel 대시보드 → 해당 프로젝트 → **Settings** → **Environment Variables**에  
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가 후 **Redeploy**.

배포된 주소를 **북마크**하거나 **폰 홈 화면에 추가**하면 어디서나 웹 앱처럼 쓸 수 있습니다.

### 로컬에서만 확인할 때

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속 (내 PC에서만 동작).

---

## 3. 와이프와 같이 쓰기

1. **둘 다 위에서 만든 웹 주소**(예: https://dd-expense.vercel.app)로 접속
2. **설정**에서 각자 **본인 이름** 입력
3. **가계부 공유 ID**를 **동일하게** 입력 (예: `우리가계부`)
4. 저장 후 사용 → 한쪽에서 입력하면 다른 쪽에도 실시간으로 보임. **JSON 보낼 필요 없음.**

---

## Supabase 안 쓸 때

`.env`를 안 만들거나 비워두면 **로컬 저장(localStorage)** 만 됩니다.  
그때는 이전처럼 내보내기/가져오기로만 공유할 수 있어요.  
Supabase 설정을 하면 자동으로 실시간 동기화 모드로 전환됩니다.
