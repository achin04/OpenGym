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
