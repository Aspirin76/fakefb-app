"use client";

import { useActionState } from "react";
import { createPostAction, type PostState } from "@/app/actions/post";

const initialState: PostState = {};

export function PostComposer() {
  const [state, formAction, pending] = useActionState(
    createPostAction,
    initialState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="rounded-xl bg-white p-4 shadow-sm">
      <textarea
        name="content"
        rows={3}
        placeholder="現在在想什麼？"
        className="fb-input resize-none"
      />
      {errors.content && (
        <p className="mt-1 text-xs text-red-600">{errors.content}</p>
      )}
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={pending} className="fb-btn">
          {pending ? "發佈中…" : "發佈"}
        </button>
      </div>
    </form>
  );
}
