import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "姓名至少要 2 個字")
    .max(50, "姓名不能超過 50 個字"),
  email: z.email("請輸入有效的 Email 格式").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "密碼至少要 8 個字元")
    .max(72, "密碼不能超過 72 個字元"),
});

export const loginSchema = z.object({
  email: z.email("請輸入有效的 Email 格式").trim().toLowerCase(),
  password: z.string().min(1, "請輸入密碼"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** 把 Zod 的錯誤物件整理成 { 欄位名稱: 第一筆訊息 } */
export function flattenErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
