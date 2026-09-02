import Image from "next/image";

type BrandMarkProps = {
  glow?: boolean;
  size?: "sm" | "md" | "lg" | "hero";
};

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  hero: "h-14 w-14 sm:h-20 sm:w-20",
};

export function BrandMark({ glow = false, size = "md" }: BrandMarkProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${sizeClasses[size]} ${
        glow
          ? "before:absolute before:inset-1 before:rounded-full before:bg-court/20 before:blur-md"
          : ""
      }`}
    >
      <Image
        src="/opengym-mark.png"
        alt=""
        width={64}
        height={68}
        aria-hidden="true"
        className="relative h-full w-full object-contain"
        priority={size === "lg" || size === "hero"}
      />
    </span>
  );
}

export function BrandLockup() {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <BrandMark glow size="md" />
      <span className="grid leading-none">
        <span className="text-lg font-semibold text-cream">
          OpenGym
        </span>
        <span className="mt-1 hidden text-[0.66rem] font-medium uppercase tracking-[0.13em] text-court-200/90 sm:inline">
          Drop-in runs
        </span>
      </span>
    </span>
  );
}
