import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";

export function NavBar() {
  return (
    <header className="sticky top-0 z-50 bg-[#1877f2] shadow-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-[#1877f2]">
            F
          </span>
          <span className="hidden text-xl font-bold sm:block">FakeBook</span>
        </Link>

        <form action="/search" className="hidden flex-1 md:block">
          <input
            type="search"
            name="q"
            placeholder="搜尋FakeBook"
            className="fb-input h-10 w-full max-w-md bg-[#f0f2f5] !py-0 !pl-4 !pr-10 text-[#1c1e21] placeholder:text-[#606770]"
          />
        </form>

        <nav className="ml-auto flex items-center gap-2">
          <Link
            href="/chat"
            className="hidden rounded-md bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30 sm:block"
          >
            聊天
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
