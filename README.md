# FakeBook

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
| **AI 聊天** | 跟 NPC 好友聊天，**用 OpenCode 當 LLM 引擎**，每個 NPC 有自己的人設與記憶 |
| 開發信箱 | 每封寄出的驗證信都會記錄在 `dev-mails.log`（含驗證連結），方便本地查看 |
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
| `npm run setup:env` | 把「貼上-Resend-金鑰.txt」的金鑰同步到 `.env` |
| `npm run test:smoke` | 端到端煙霧測試（需先開好 dev server） |
| `npm run test:chat` | 聊天功能測試：登入 → 送訊息 → 確認 NPC 回覆 |
| `npm run test:email` | 真的呼叫 Resend 寄一封信出來（需先開好 dev server） |
| `npm run lint` | ESLint |

---

## Resend 設定（寄驗證信）

### 步驟

1. 到 [resend.com/api-keys](https://resend.com/api-keys) 建立 API key（權限選 **Sending access** 即可）。
2. 用記事本打開專案根目錄的 **`貼上-Resend-金鑰.txt`**，把金鑰貼在 `RESEND_API_KEY=` 後面並存檔。
   （這支金鑰等同密碼，該檔案已被 `.gitignore` 排除，不會被 commit）
3. 執行同步指令，把金鑰寫進 `.env`：

   ```bash
   npm run setup:env
   ```

4. 重新啟動 `npm run dev`，之後就會真的寄信了。

> 也可以直接手動編輯 `.env`，效果一樣；`npm run setup:env` 只是幫你不用改格式。

### 寄件人 `EMAIL_FROM`

- **還沒驗證網域**：用沙盒 `FakeBook <onboarding@resend.dev>`，但 **只能寄到你的 Resend 帳號信箱**。
- **有自己的網域**：到 Resend Dashboard → Domains 新增網域，照著設定 DNS（SPF / DKIM）驗證通過後，
  在 `貼上-Resend-金鑰.txt` 的 `EMAIL_FROM=` 填 `"FakeBook <noreply@yourdomain.com>"`，再跑一次 `npm run setup:env`。

### `APP_URL`

要跟實際跑的網址一致，驗證連結會用這個值組出來（正式環境記得改成你的網域）。

> 測試時不要用 `test@gmail.com` 這種假地址，真的寄出去會退信並拉低寄信評質。
> 想測成功/退信/檢舉三種結果，用 Resend 提供的 `delivered@resend.dev`、`bounced@resend.dev`、`complained@resend.dev`。
>
> 沒設定金鑰時會自動進入**開發模式**：不寄信，但驗證連結會直接顯示在畫面上，流程照跑。

### 開發信箱記錄檔 `dev-mails.log`

開發環境下，每一封寄出的驗證信都會被記錄下來（時間、收件人、主旨、驗證連結），
就像 Django 的 console email backend 一樣：

```
============================================================
時間: 2026/10/22 下午 1:43:07
收件人: delivered+smoke1792647786507@resend.dev
主旨: 【FakeBook】請驗證你的 Email 帳號
驗證連結: http://localhost:3000/verify-email?token=1b3d3848...
```

這個檔案已加入 `.gitignore`，不會被 commit。

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

## AI 聊天（OpenCode 當 LLM 引擎）

FakeBook 裡有兩個 NPC 好友：**小葵**（開朗好奇）跟 **阿哲**（沉穩理性）。
登入後從 navbar 的「聊天」進去就能跟他們對話，也可以組成**群組聊天**讓兩個人一起回你。

### 聊天功能

| 功能 | 說明 |
| --- | --- |
| 1 對 1 / 群組聊天 | 群組聊天時 AI 會用「名字：內容」回覆，自動拆成不同人的訊息 |
| 貼圖 | 😊 按鈕開啟貼圖列，16 個表情可直接送 |
| 快速回覆 | 輸入框上方的常用語一鍵送出 |
| 回覆引用 | 點訊息 → 回覆，會顯示被引用的內容 |
| 表情回應 | 點訊息 → 選表情，可以再加一次取消 |
| 刪除訊息 | 只能刪自己的，刪掉後顯示「這則訊息已刪除」 |
| 複製 | 點訊息 → 複製 |
| 已讀 / 已送出 | 自己最後一則訊息旁邊顯示 |
| 未讀徽章 | 聊天清單顯示未讀數與最後一則訊息預覽 |
| 日期分隔 | 訊息依日期插入分隔線 |
| 打字中 | 等待 AI 回覆時顯示三點動畫 |

### 運作原理

```
瀏覽器 → POST /api/chat/[id]/messages
             │
             ├─ 1. 使用者訊息寫進 SQLite
             ├─ 2. 呼叫 OpenCode（本機背景服務）送出訊息
             │      每段對話 = 一個 OpenCode agent（人設寫在 system prompt）
             │      每段對話 = 一個 OpenCode session（所以有上下文記憶）
             ├─ 3. 輪詢 OpenCode 直到拿到文字回覆
             ├─ 4. 群組的話把「名字：內容」拆成多則訊息
             └─ 5. 回覆寫進 SQLite → 回傳給瀏覽器
```

- **引擎**：`@opencode/client` 連到本機的 OpenCode 背景服務（`Service.ensure()` 會自動發現或啟動）
- **模型**：`OPENCODE_MODEL`，預設 `opencode/minimax-m3.1-flash-free`
- **人設**：寫在 `src/lib/npcs.ts`，會被轉成 OpenCode agent 的 system prompt
- **工作目錄**：每段對話一個資料夾（預設 `%TEMP%/fakebook-npc/<指紋>/`），
  裡面會產生 `opencode.json` 與該對話的 OpenCode session
- **人設改了會自動開新 session**（用 prompt 指紋判斷），避免舊角色殘留

### 已知限制

- 回覆要 3～20 秒（free tier 模型 + 本機推論），free tier 忙碌時會自動重試
- OpenCode free tier **不接受把工具權限全部關掉的設定**（會回 403），
  所以 NPC 的工具是用「人設 prompt」約束，而不是權限封鎖。
  就算 AI 真的去用工具，也只會在它自己的暫存工作目錄裡。

### 測試

```bash
npm run dev        # 終端機 1
npm run test:chat  # 終端機 2：建立對話 → 送訊息 → 表情 / 引用 / 刪除 / 群組
```

---

## 專案結構

```
prisma/
  schema.prisma          User / Session / VerificationToken / Post / Conversation / ConversationMember / Message
  seed.mjs               示範資料 + NPC 角色
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
    chat/                聊天（對話清單 / 對話頁）
    api/auth/me/         給 navbar 查目前登入者
    api/chat/            建立對話（1 對 1 / 群組）
    api/chat/[conversationId]/messages/          送訊息
    api/chat/[conversationId]/messages/[id]/react  表情回應
    api/chat/[conversationId]/messages/[id]/       刪除訊息
    api/chat/[conversationId]/read/               標記已讀
    actions/
      auth.ts            register / login / logout / resend 這幾個 Server Action
      post.ts            發貼 Server Action
  components/
    NavBar.tsx  UserMenu.tsx  RegisterForm.tsx  LoginForm.tsx
    ResendVerificationForm.tsx  PostComposer.tsx
    ChatPanel.tsx  NewChatButton.tsx  NewChatDialog.tsx
  lib/
    prisma.ts            Prisma Client 單例
    session.ts           session 建立 / 讀取 / 銷毀
    verification.ts      驗證 token 產生與核對
    email.ts             Resend 寄信 + HTML 樣板
    opencode.ts          OpenCode 聊天引擎（NPC agent / session / 收訊息 / 群組拆訊息）
    chat.ts              聊天室資料存取（對話、成員、未讀數、訊息序列化）
    npcs.ts              NPC 角色設定
    validation.ts        Zod schema
scripts/
  smoke-test.mjs         端到端煙霧測試
  test-chat.mjs          聊天功能測試
  test-email-send.mjs    真實寄信測試
  sync-env.mjs           把「貼上-Resend-金鑰.txt」同步到 .env
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
