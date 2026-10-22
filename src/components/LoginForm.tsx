"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
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
          Email
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

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold">
          密碼
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="你的密碼"
          className="fb-input"
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600">{errors.password}</p>
        )}
      </div>

      <button type="submit" disabled={pending} className="fb-btn w-full">
        {pending ? "登入中…" : "登入"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/resend-verification"
          className="font-semibold text-[#1877f2] hover:underline"
        >
          忘記密碼 / 沒收到驗證信？
        </Link>
      </div>

      <p className="text-center text-sm text-[#606770]">
        還沒有帳號？{" "}
        <Link
          href="/register"
          className="font-semibold text-[#1877f2] hover:underline"
        >
          註冊
        </Link>
      </p>
    </form>
  );
}
