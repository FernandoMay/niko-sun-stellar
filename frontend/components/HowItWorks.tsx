"use client";

const steps = [
  {
    num: "01",
    icon: "account_balance_wallet",
    title: "Conecta tu Wallet",
    description:
      "Conecta Freighter en Stellar Testnet. La llave privada permanece en tu wallet; la aplicación solo solicita la firma de la transacción.",
    tag: "FREIGHTER + SOROBAN",
    tagColor: "text-orange-600",
    iconBg: "bg-orange-50 border-orange-200 text-orange-600",
    glow: "bg-orange-100",
  },
  {
    num: "02",
    icon: "solar_power",
    title: "Elige un Proyecto On-chain",
    description:
      "Consulta nombre, precio, supply, tokens acuñados, ventas y estado directamente desde el contrato. Si una lectura falla, el proyecto aparece como no disponible.",
    tag: "ESTADO OBSERVABLE",
    tagColor: "text-emerald-700",
    iconBg: "bg-emerald-50 border-emerald-200 text-emerald-600",
    glow: "bg-emerald-100",
  },
  {
    num: "03",
    icon: "payments",
    title: "Compra y Reclama",
    description:
      "Compra participaciones con XLM nativo. El creator deposita ingresos en el contrato y cada holder puede reclamar únicamente su saldo proporcional.",
    tag: "XLM NATIVO + RECLAMO EXPLÍCITO",
    tagColor: "text-amber-700",
    iconBg: "bg-amber-50 border-amber-200 text-amber-600",
    glow: "bg-amber-100",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="w-full max-w-7xl mx-auto px-5 lg:px-10 py-16">
      <div className="flex flex-col items-center text-center space-y-3 max-w-3xl mx-auto mb-12">
        <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-5 py-2 rounded-full font-semibold">
          Infraestructura Simple y Verificable
        </span>
        <h2 className="font-display text-[24px] leading-[32px] lg:text-[40px] lg:leading-[48px] text-slate-900 font-bold">
          ¿Cómo Funciona el Protocolo NIKO SUN?
        </h2>
        <p className="text-[14px] text-slate-600 leading-relaxed">
          El contrato conserva el estado financiero. La interfaz muestra sus
          lecturas yestimaciones separadas; no convierte telemetría demo en
          evidencia verificada.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => (
          <div
            key={step.num}
            className="relative p-8 rounded-xl bg-white border border-slate-200 flex flex-col justify-between overflow-hidden shadow-md group hover:border-emerald-300 hover:shadow-lg transition-all duration-300"
          >
            <div
              className={`absolute -right-6 -top-6 w-24 h-24 ${step.glow} rounded-full blur-2xl group-hover:opacity-80 transition-all`}
            />
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="font-display text-[32px] font-bold text-slate-200 select-none">
                  {step.num}
                </span>
                <div
                  className={`w-12 h-12 rounded-lg ${step.iconBg} border flex items-center justify-center`}
                >
                  <span className="material-symbols-outlined text-[26px]">
                    {step.icon}
                  </span>
                </div>
              </div>
              <h3 className="font-display text-[20px] text-slate-900 mb-2 font-bold">
                {step.title}
              </h3>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                {step.description}
              </p>
            </div>

            <div className="mt-6 pt-3 flex items-center gap-2 font-mono text-[11px] font-semibold">
              <span className={step.tagColor}>{step.tag}</span>
              <span className={`material-symbols-outlined ${step.tagColor} text-[14px]`}>
                arrow_forward
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
