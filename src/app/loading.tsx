/** Squelette générique pendant la résolution d'un segment. */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3 bg-[var(--color-app)] p-4">
      <div className="skeleton h-10 w-2/3 rounded-[14px]" />
      <div className="skeleton h-11 w-full rounded-[18px]" />

      <div className="skeleton h-[70px] w-full rounded-[18px]" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="skeleton h-[190px] rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}
