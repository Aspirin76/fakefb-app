"use client";

import { useActionState } from "react";
import { resendVerificationAction, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

export function ResendVerificationForm() {
  const [state, formAction, pending] = useActionState(
    resendVerificationAction,
    initialState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold">
          註冊時使用的 Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="fb-input"
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email}</p>
        )}
      </div>

      <button type="submit" disabled={pending} className="fb-btn w-full">
        {pending ? "寄送中…" : "重新寄送驗證信"}
      </button>
    </form>
  );
}
