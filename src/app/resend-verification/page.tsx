import type { Metadata } from "next";
import Link from "next/link";
import { ResendVerificationForm } from "@/components/ResendVerificationForm";

export const metadata: Metadata = {
  title: "重新寄送驗證信",
};

export default function ResendVerificationPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#1877f2]">重新寄送驗證信</h1>
        <p className="mt-1 text-sm text-[#606770]">
          輸入你註冊時使用的 Email，我們會再寄一封驗證信給你。
        </p>
        <div className="mt-6">
          <ResendVerificationForm />
        </div>
        <p className="mt-4 text-center text-sm text-[#606770]">
          想起密碼了？{" "}
          <Link href="/login" className="font-semibold text-[#1877f2] hover:underline">
            回到登入
          </Link>
        </p>
      </div>
    </div>
  );
}
