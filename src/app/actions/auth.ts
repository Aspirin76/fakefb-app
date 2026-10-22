"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { createSession, destroySession } from "@/lib/session";
import { createVerificationToken } from "@/lib/verification";
import { flattenErrors, loginSchema, registerSchema } from "@/lib/validation";

export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const BCRYPT_ROUNDS = 12;

/** 註冊：建立帳號 -> 產生驗證 token -> 寄驗證信 */
export async function registerAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenErrors(parsed.error) };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: "這個 Email 已經註冊過了" } };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hash(password, BCRYPT_ROUNDS),
    },
  });

  const token = await createVerificationToken(user.id);

  let devVerifyUrl: string | undefined;
  try {
    const result = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token,
      // 24 小時內同一組 token 重試不會重複寄信
      idempotencyKey: `verify-email/${user.id}/${token.slice(0, 16)}`,
    });
    if (result.devMode) devVerifyUrl = result.verifyUrl;
  } catch (error) {
    console.error("[register] 寄送驗證信失敗:", error);
    return {
      error:
        "帳號已建立，但驗證信寄送失敗，請到「重新寄送驗證信」頁面再試一次。",
    };
  }

  redirect(
    `/check-email?email=${encodeURIComponent(user.email)}${
      devVerifyUrl ? `&dev=${encodeURIComponent(devVerifyUrl)}` : ""
    }`,
  );
}

/** 登入：驗證密碼 + 確認 Email 已驗證 */
export async function loginAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenErrors(parsed.error) };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "Email 或密碼錯誤" };
  }

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    return { error: "Email 或密碼錯誤" };
  }

  if (!user.emailVerified) {
    return {
      error: "這個帳號的 Email 還沒驗證，請先查收驗證信或重新寄送。",
    };
  }

  await createSession(user.id);
  redirect("/feed");
}

/** 登出 */
export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/** 重新寄送驗證信 */
export async function resendVerificationAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { fieldErrors: { email: "請輸入 Email" } };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // 不透露這個 Email 有沒有註冊過
    redirect(`/check-email?email=${encodeURIComponent(email)}`);
  }

  if (user!.emailVerified) {
    return { error: "這個帳號已經驗證過了，請直接登入。" };
  }

  const token = await createVerificationToken(user!.id);

  let devVerifyUrl: string | undefined;
  try {
    const result = await sendVerificationEmail({
      to: user!.email,
      name: user!.name,
      token,
      idempotencyKey: `verify-email/${user!.id}/${token.slice(0, 16)}`,
    });
    if (result.devMode) devVerifyUrl = result.verifyUrl;
  } catch (error) {
    console.error("[resend] 寄送驗證信失敗:", error);
    return { error: "驗證信寄送失敗，請確認 RESEND_API_KEY 設定正確後再試一次。" };
  }

  redirect(
    `/check-email?email=${encodeURIComponent(email)}${
      devVerifyUrl ? `&dev=${encodeURIComponent(devVerifyUrl)}` : ""
    }`,
  );
}
