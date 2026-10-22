import type { Metadata } from "next";
import { RegisterForm } from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "註冊",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#1877f2]">註冊FakeBook</h1>
        <p className="mt-1 text-sm text-[#606770]">
          填完資料後會寄一封驗證信到你的信箱。
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
