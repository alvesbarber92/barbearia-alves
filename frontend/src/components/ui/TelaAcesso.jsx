export default function TelaAcesso({ children }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-5 py-10">

      <div className="login-foto" aria-hidden="true" />
      <div className="login-veu" aria-hidden="true" />

      <main className="relative z-10 w-full max-w-sm">
        <div className="card p-8 shadow-flutua">

          <div className="flex justify-center mb-7">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" className="w-9 h-9 flex-shrink-0" />
              <span className="font-display text-card">
                BarberVez
              </span>
            </div>
          </div>

          {children}
        </div>

        <p className="text-micro text-cal-2 text-center mt-6">© 2026 BarberVez</p>
      </main>
    </div>
  )
}
