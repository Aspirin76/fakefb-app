"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-semibold">
          姓名
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="王小明"
          className="fb-input"
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-xs text-red-600">
            {errors.name}
          </p>
        )}
      </div>

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
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-xs text-red-600">
            {errors.email}
          </p>
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
          autoComplete="new-password"
          placeholder="至少 8 個字元"
          className="fb-input"
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password && (
          <p id="password-error" className="mt-1 text-xs text-red-600">
            {errors.password}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className="fb-btn w-full">
        {pending ? "建立中…" : "註冊"}
      </button>

      <p className="text-center text-sm text-[#606770]">
        已經有帳號了？{" "}
        <Link href="/login" className="font-semibold text-[#1877f2] hover:underline">
          登入
        </Link>
      </p>
    </form>
  );
}
