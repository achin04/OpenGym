import Image from "next/image";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  return (
    <span className={`relative inline-flex shrink-0 ${sizeClasses[size]}`}>
      <Image
        src="/opengym-mark.png"
        alt=""
        width={64}
        height={68}
        aria-hidden="true"
        className="h-full w-full object-contain"
        priority={size === "lg"}
      />
    </span>
  );
}

export function BrandLockup() {
  return (
    <span className="flex min-w-0 items-center gap-2 sm:gap-3">
      <BrandMark size="sm" />
      <span className="grid leading-none">
        <span className="text-base font-semibold text-cream sm:text-base">
          OpenGym
        </span>
        <span className="mt-1 hidden text-[0.65rem] font-medium uppercase tracking-[0.18em] text-court-200 sm:inline">
          Drop-in runs
        </span>
      </span>
    </span>
  );
}
