export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center sm:items-start sm:text-left">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            UConnect
          </h1>
          <p className="mt-3 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Local-first development with Supabase Auth + Postgres.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a
            className="flex h-11 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
            href="/auth"
          >
            Sign in / Sign up
          </a>
          <a
            className="flex h-11 w-full items-center justify-center rounded-xl border border-black/8 bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-black/4 sm:w-auto dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/6"
            href="/profile"
          >
            Profile
          </a>
        </div>
      </main>
    </div>
  );
}
