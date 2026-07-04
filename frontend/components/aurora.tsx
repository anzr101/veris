export function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="animate-drift absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-signal/10 blur-[120px]" />
      <div className="animate-drift absolute -top-20 right-10 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-[120px] [animation-delay:-6s]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(700px 380px at 50% 0%, black, transparent)",
          WebkitMaskImage: "radial-gradient(700px 380px at 50% 0%, black, transparent)",
        }}
      />
    </div>
  );
}
