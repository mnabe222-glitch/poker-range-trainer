// src/components/ResponsiveShell.tsx
export default function ResponsiveShell({ left, center, right, footer }: any) {
  return (
    <div className="min-h-[100dvh] grid grid-rows-[1fr_auto] bg-white">
      {/* コンテンツ部分は縦並び＋余白 */}
      <main className="p-3 space-y-6">
        <section>{left}</section>
        <section>{center}</section>
        <section>{right}</section>
      </main>

      {/* フッターは固定で下に */}
      <nav className="sticky bottom-0 w-full border-t bg-white/90 backdrop-blur p-2">
        <div className="grid grid-cols-3 gap-2">
          {footer}
        </div>
        {/* iPhone下部の安全領域（ホームバー部分）対応 */}
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}

