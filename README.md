# 假FB (FakeFB)

一個仿造 Facebook 的社群網站練習專案。目前完成 **註冊 / 登入 + Email 驗證信** 的完整流程。

---

## 功能

| 功能 | 說明 |
| --- | --- |
| 註冊 | 姓名 / Email / 密碼，密碼以 bcrypt（12 rounds）雜湊儲存 |
| Email 驗證信 | 透過 [Resend](https://resend.com) 寄送，內含 24 小時有效、只能使用一次的驗證連結 |
| 登入 / 登出 | httpOnly + SameSite=Lax 的 session cookie，session 存在資料庫 |
| 重新寄送驗證信 | 沒收到信可以自己再寄一封 |
| 動態牆 | 登入後可以發文、看到自己的貼文 |
| 搜尋 | 依姓名 / Email 找使用者 |
| 開發模式 | 沒設定 `RESEND_API_KEY` 時，驗證連結會直接顯示在畫面上，流程照跑 |

---

## 技術堆疊

- **Next.js 16**（App Router、Turbopack、Cache Components / PPR、Server Actions）
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma 6 + SQLite**
- **Resend**（寄送驗證信）
- **Zod**（表單驗證）、**bcryptjs**（密碼雜湊）

---

## 快速開始

```bash
npm install          # 安裝套件（會自動執行 prisma generate）

cp .env.example .env # 複製環境變數範本
#   ↓ 至少要填 RESEND_API_KEY（沒填也能跑，會用開發模式）

npm run db:push      # 建立 / 更新 SQLite 資料庫
npm run db:seed      # （選用）建立示範帳號 demo@fakefb.test / password123

npm run dev          # http://localhost:3000
```

### 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` / `npm start` | 建置 / 啟動正式版本 |
| `npm run db:push` | 把 schema 同步到資料庫（開發用） |
| `npm run db:migrate` | 產生 migration 檔 |
| `npm run db:studio` | 開啟 Prisma Studio 看資料 |
| `npm run db:seed` | 建立示範資料 |
| `npm run test:smoke` | 端到端煙霧測試（需先開好 dev server） |
| `npm run lint` | ESLint |

---

## Resend 設定（寄驗證信）

1. 到 [resend.com/api-keys](https://resend.com/api-keys) 建立 API key（權限選 **Sending access** 即可）。
2. 把 key 填進 `.env`：

   ```env
   RESEND_API_KEY="re_xxxxxxxx"
   ```

3. 設定寄件人 `EMAIL_FROM`：
   - **還沒驗證網域**：用沙盒 `假FB <onboarding@resend.dev>`，但 **只能寄到你的 Resend 帳號信箱**。
   - **有自己的網域**：到 Resend Dashboard → Domains 新增網域，照著設定 DNS（SPF / DKIM）驗證通過後，
     `EMAIL_FROM` 改成 `"假FB <noreply@yourdomain.com>"`。

4. `APP_URL` 要跟實際跑的網址一致，驗證連結會用這個值組出來（正式環境記得改成你的網域）。

> 測試時不要用 `test@gmail.com` 這種假地址，真的寄出去會退信並拉低寄信評質。
> 想測成功/退信/檢舉三種結果，用 Resend 提供的 `delivered@resend.dev`、`bounced@resend.dev`、`complained@resend.dev`。

---

## Email 驗證流程

```
使用者註冊
   └─> 建立 User（emailVerified = null）+ VerificationToken
   └─> 寄出驗證信，連結為 /verify-email?token=<隨機 token>
            │
            ▼
   使用者點連結
   └─> 拿 token 做 SHA-256 雜湊，比對資料庫
   └─> 檢查有沒有過期（24 小時）、是不是已經用過
   └─> 通過的話把 emailVerified 設成現在的時間，並刪掉 token
            │
            ▼
   登入時檢查 emailVerified，沒驗證不給登入
```

安全細節：

- 原始 token **只會出現在寄給使用者的信裡**，資料庫只存 SHA-256 雜湊，資料庫被偷也驗不了信。
- token 24 小時過期、**只能用一次**（驗證成功後立刻刪除）。
- 同一個使用者的舊 token 會在重寄時被清掉，永遠只有最新一組有效。
- 寄信使用 Resend 的 `idempotencyKey`，重試不會重複寄出同一封信。
- 登入失敗（Email 或密碼錯誤）不透露是 Email 還是密碼不對；重新寄送驗證信也不透露 Email 有沒有註冊過。

---

## 專案結構

```
prisma/
  schema.prisma          User / Session / VerificationToken / Post
  seed.mjs               示範資料
src/
  app/
    layout.tsx           根版面 + navbar
    page.tsx             首頁
    register/            註冊頁
    login/               登入頁
    check-email/         「請查收驗證信」頁
    verify-email/        驗證連結 landing page（驗證成功/過期/無效）
    resend-verification/ 重寄驗證信
    feed/                動態牆（需登入）
    search/              搜尋使用者
    api/auth/me/         給 navbar 查目前登入者
    actions/
      auth.ts            register / login / logout / resend 這幾個 Server Action
      post.ts            發貼 Server Action
  components/
    NavBar.tsx  UserMenu.tsx  RegisterForm.tsx  LoginForm.tsx
    ResendVerificationForm.tsx  PostComposer.tsx
  lib/
    prisma.ts            Prisma Client 單例
    session.ts           session 建立 / 讀取 / 銷毀
    verification.ts      驗證 token 產生與核對
    email.ts             Resend 寄信 + HTML 樣板
    validation.ts        Zod schema
scripts/
  smoke-test.mjs         端到端煙霧測試
```

---

## 驗證方式

```bash
npm run dev            # 開一個終端機
npm run test:smoke     # 另一個終端機執行
```

會依序測：註冊 → 驗證信連結 → 登入 → 動態牆 → token 不能重複使用 → 未驗證不能登入 → 重複註冊 → 發貼。

---

## 下一步（可以接著做）

- 好友 / 追蹤、貼文按讚與留言
- 個人資料頁、封面與頭像上傳
- 忘記密碼（重設信）、變更 Email
- 貼文圖片上傳、通知、好友動態
