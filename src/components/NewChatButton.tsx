"use client";

import { useState } from "react";
import { NewChatDialog } from "@/components/NewChatDialog";

type Npc = { id: string; name: string; color: string; handle: string };

/** 「新增對話」按鈕 + 選人對話框 */
export function NewChatButton({ npcs }: { npcs: Npc[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-[#1877f2] hover:bg-gray-100"
      >
        新增對話
      </button>
      {open && (
        <NewChatDialog npcs={npcs} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
