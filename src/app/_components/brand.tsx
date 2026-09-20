import Image from "next/image";

export function BrandMark() {
  return (
    <span className="inline-flex shrink-0 items-center">
      <Image
        src="/opengymlogo.png"
        alt="OpenGym"
        width={148}
        height={113}
        priority
        className="h-20 w-auto object-contain"
      />
    </span>
  );
}

export function BrandLockup() {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <BrandMark />
      <span className="hidden text-sm font-semibold uppercase tracking-[0.13em] text-court sm:inline">
        Drop-in runs
      </span>
    </span>
  );
}
