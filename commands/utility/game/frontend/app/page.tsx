
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function GameLobby() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-10 text-[#202123]">
      <header className="mx-auto flex max-w-4xl items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl shadow-sm">
          🎮
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Game Lobby
          </h1>
          <p className="text-xs text-gray-500">
            Multiplayer gaming room
          </p>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-4xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-gray-500">
                ห้องเล่นเกม
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                ยินดีต้อนรับสู่ Lobby
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                รวมตัวกับเพื่อน ๆ ก่อนเริ่มเล่นเกม
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  token ? "bg-amber-400" : "bg-gray-400"
                }`}
              />
              {token ? "กำลังรอเชื่อมต่อ" : "ยังไม่มีห้องเกม"}
            </div>
          </div>

          <div className="my-7 border-t border-gray-100" />

          {!token ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-10 text-center">
              <div className="text-3xl">🔗</div>
              <h3 className="mt-3 font-medium">
                ไม่พบลิงก์เข้าร่วมห้อง
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                กรุณาเปิดลิงก์ที่บอทส่งให้ใน Discord
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">
                    ผู้เล่นออนไลน์
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-3xl font-semibold">0</span>
                    <span className="pb-1 text-sm text-gray-500">
                      คน
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">
                    สถานะระบบ
                  </p>
                  <p className="mt-3 font-medium text-amber-600">
                    กำลังรอ WebSocket
                  </p>
                </div>
              </div>

              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">ผู้เล่นในห้อง</h3>
                  <span className="text-sm text-gray-500">
                    0 คน
                  </span>
                </div>

                <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
                    👥
                  </div>
                  <p className="mt-4 text-sm font-medium text-gray-700">
                    ยังไม่มีข้อมูลผู้เล่น
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    รายชื่อจะปรากฏตรงนี้เมื่อเชื่อมต่อระบบสำเร็จ
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          Game Lobby · Powered by Discord
        </p>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] text-sm text-gray-500">
          กำลังโหลดห้องเกม...
        </main>
      }
    >
      <GameLobby />
    </Suspense>
  );
}
