import { useRef } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Wrap any content with a "Share as JPG" corner button.
 * When clicked, captures the wrapped node as a PNG (browser-side), copies to
 * clipboard, downloads, AND attempts navigator.share() on mobile.
 */
export function Shareable({ children, filename = "share.png", label = "Share", testId }) {
  const ref = useRef(null);

  const share = async () => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      // Download
      const a = document.createElement("a");
      a.href = dataUrl; a.download = filename; a.click();
      // Attempt Web Share API (mobile / supported desktops)
      if (navigator.share && navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], filename, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
          }
        } catch (_e) { /* user cancelled or unsupported */ }
      }
      toast.success("Image ready");
    } catch (e) {
      console.error(e);
      toast.error("Failed to capture image");
    }
  };

  return (
    <div className="relative group" ref={ref}>
      {children}
      <button
        type="button"
        onClick={share}
        data-testid={testId || "share-btn"}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-stone-200 shadow-sm rounded-md p-1.5 hover:bg-emerald-900 hover:text-white hover:border-emerald-900 text-stone-600"
        title={`${label} as JPG`}
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
