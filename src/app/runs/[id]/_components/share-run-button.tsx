"use client";

import { useEffect, useState } from "react";

/**
 * Shares the run, or copies its link.
 *
 * Three paths, in the order they are worth trying:
 *
 * navigator.share hands the URL to the operating system's own share sheet,
 * which is what someone on a phone expects and is the only way to reach their
 * messaging apps. It exists on mobile browsers and almost nowhere on desktop.
 *
 * navigator.clipboard covers the rest, but only in a secure context -- on
 * plain http it is simply undefined, which includes testing from another
 * device on the local network.
 *
 * The last path is a hidden textarea and execCommand, deprecated but still
 * the only thing that works without a secure context. A share button that
 * does nothing is worse than a deprecated API.
 */
async function copyToClipboard(url: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Permission denied or a non-secure context: fall through.
    }
  }

  try {
    const field = document.createElement("textarea");
    field.value = url;
    // Kept out of the viewport rather than display:none, which would make it
    // unselectable and the copy a no-op.
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(field);
    return copied;
  } catch {
    return false;
  }
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 15V3m0 0L8 7m4-4 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function ShareRunButton({ title }: { title: string }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast === null) {
      return;
    }

    const timer = setTimeout(() => setToast(null), 2400);

    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={async () => {
          // Read at click time rather than kept in state: the component is
          // server-rendered first, where there is no location, and an effect
          // that sets state on mount only to produce a value the handler can
          // read directly is a render for nothing.
          const shareUrl = window.location.href;

          if (navigator.share) {
            try {
              await navigator.share({ title, url: shareUrl });
              return;
            } catch {
              // Includes the user dismissing the sheet, which is not a failure
              // and must not fall through to copying something they cancelled.
              return;
            }
          }

          setToast(
            (await copyToClipboard(shareUrl))
              ? "Link copied"
              : "Could not copy the link",
          );
        }}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border-2 border-foreground bg-white text-[15px] font-bold text-foreground shadow-[0_4px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out hover:translate-y-[2px] hover:shadow-[0_2px_0_0_var(--foreground)] active:translate-y-[4px] active:shadow-none motion-reduce:transition-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <ShareIcon className="h-[17px] w-[17px]" />
        Share run
      </button>

      {/*
        aria-live rather than a visual-only toast: without it the only
        confirmation that anything happened is a message a screen reader never
        announces.
      */}
      <p
        aria-live="polite"
        className={`pointer-events-none absolute inset-x-0 -bottom-9 text-center text-sm font-semibold text-foreground transition-opacity duration-200 motion-reduce:transition-none ${
          toast ? "opacity-100" : "opacity-0"
        }`}
      >
        {toast}
      </p>
    </div>
  );
}
