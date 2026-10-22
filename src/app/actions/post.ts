"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { flattenErrors } from "@/lib/validation";

export type PostState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const postSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "請輸入貼文內容")
    .max(500, "貼文不能超過 500 個字"),
});

/** 發貼 */
export async function createPostAction(
  _prevState: PostState,
  formData: FormData,
): Promise<PostState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = postSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { fieldErrors: flattenErrors(parsed.error) };
  }

  await prisma.post.create({
    data: { content: parsed.data.content, authorId: user!.id },
  });

  revalidatePath("/feed");
  return {};
}
