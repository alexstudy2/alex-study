"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import {
  MAX_IMAGE_BYTES,
  MAX_TOPICS,
  type ExamTopic,
} from "@/lib/exam-plans/topics";
import {
  examPlanErrorMessage,
  examPlanOfflineMessage,
  type ExamPlanErrorPayload,
} from "./exam-plan-errors";

/**
 * Photograph the فهرس, get topic rows.
 *
 * Two rules shape this component. The picture is downscaled in the browser before it is posted --
 * a phone camera produces 8 MB of JPEG that no vision model needs and a serverless body limit
 * would refuse. And the result lands in the composer as editable rows, never straight into a
 * generation: OCR misreads Arabic diacritics and page numbers, and the student is the only one who
 * can say which line was actually a chapter title.
 */

/** Longest edge, in CSS pixels. Enough for small print in a book index; a fraction of the original. */
const TARGET_EDGE = 1400;
const RETRY_EDGE = 1000;

async function toDataUrl(file: File) {
  // createImageBitmap decodes off the main thread and, unlike an <img>, refuses formats the canvas
  // cannot draw -- so a HEIC straight off an iPhone fails here, loudly, instead of posting a blank.
  const bitmap = await createImageBitmap(file);
  try {
    for (const edge of [TARGET_EDGE, RETRY_EDGE]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no_canvas");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // JPEG, always: the server's data-URL guard accepts png/jpeg/webp, and jpeg is the one every
      // browser's toDataURL is required to produce.
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      if (dataUrl.length * 0.75 <= MAX_IMAGE_BYTES) return dataUrl;
    }
    throw new Error("too_large");
  } finally {
    bitmap.close();
  }
}

export function SyllabusScanner({
  ar,
  disabled = false,
  topicCount,
  onTopics,
}: {
  ar: boolean;
  disabled?: boolean;
  topicCount: number;
  /** Rows go to the composer, appended to whatever is already there. */
  onTopics: (topics: ExamTopic[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  /** Pages that actually yielded rows -- a failed read should not relabel the button "another page". */
  const [pages, setPages] = useState(0);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  /** Set once the model id is not served: the button goes away and the composer carries on. */
  const [unavailable, setUnavailable] = useState(false);
  const full = topicCount >= MAX_TOPICS;

  async function scan(file: File) {
    setPending(true);
    setStatus("");
    setFailed(false);
    try {
      const image = await toDataUrl(file).catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : "";
        throw new Error(reason === "too_large" ? "too_large" : "unreadable_file");
      });
      setThumbnail(image);
      const response = await fetch("/api/exam-plans/extract-topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (ExamPlanErrorPayload & { topics?: ExamTopic[]; warning?: string | null })
        | null;
      if (!response.ok) {
        if (payload?.error === "vision_unavailable") setUnavailable(true);
        setFailed(true);
        setStatus(examPlanErrorMessage(payload, ar));
        return;
      }
      const topics = (payload?.topics ?? []).slice(0, MAX_TOPICS - topicCount);
      if (!topics.length) {
        setFailed(true);
        setStatus(examPlanErrorMessage({ error: "nothing_read" }, ar));
        return;
      }
      onTopics(topics);
      setPages((count) => count + 1);
      const read = ar
        ? `قرأنا ${topics.length} موضوعًا. راجعها وصحّح ما يحتاج.`
        : `Read ${topics.length} topic${topics.length === 1 ? "" : "s"}. Check them and fix anything odd.`;
      const loose =
        payload?.warning === "read_as_text"
          ? ar
            ? " (قُرئت كسطور، فقد تحتاج الأبواب ضبطًا.)"
            : " (Read line by line, so chapters may need setting.)"
          : payload?.warning === "truncated"
            ? ar
              ? " (الصفحة طويلة، فتوقفنا عند الحد.)"
              : " (Long page — we stopped at the limit.)"
            : "";
      setStatus(`${read}${loose}`);
    } catch (error) {
      setFailed(true);
      const reason = error instanceof Error ? error.message : "";
      if (reason === "unreadable_file")
        setStatus(
          ar
            ? "تعذّر قراءة هذه الصورة. جرّب صورة PNG أو JPEG."
            : "That image could not be read. Try a PNG or JPEG.",
        );
      else if (reason === "too_large")
        setStatus(ar ? "الصورة كبيرة جدًا. جرّب صورة أصغر." : "That image is too large. Try a smaller one.");
      else setStatus(examPlanOfflineMessage(ar));
    } finally {
      setPending(false);
      // Clearing the input is what makes photographing the same page twice fire onChange again.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (unavailable) {
    return (
      <p className="exam-upload-note" role="status">
        {examPlanErrorMessage({ error: "vision_unavailable" }, ar)}
      </p>
    );
  }

  return (
    <div className="exam-upload">
      <div className="exam-upload-row">
        <label className="exam-upload-btn" data-disabled={disabled || pending || full ? "yes" : undefined}>
          {pending ? (
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
          ) : (
            <Camera aria-hidden="true" className="w-4 h-4" />
          )}
          <span>
            {pending
              ? ar
                ? "نقرأ الصورة…"
                : "Reading the photo…"
              : pages
                ? ar
                  ? "أضف صفحة أخرى"
                  : "Add another page"
                : ar
                  ? "صوّر الفهرس"
                  : "Photograph the index"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            /* Opens the camera directly on a phone, which is where a book index gets photographed. */
            capture="environment"
            className="sr-only"
            disabled={disabled || pending || full}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void scan(file);
            }}
          />
        </label>
        {thumbnail && (
          <div className="exam-upload-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element -- a canvas data URL, not an asset */}
            <img src={thumbnail} alt={ar ? "الصورة المقروءة" : "The scanned page"} />
            <button
              type="button"
              className="exam-upload-thumb-clear"
              aria-label={ar ? "إزالة الصورة" : "Remove the photo"}
              onClick={() => {
                setThumbnail(null);
                setStatus("");
                setFailed(false);
              }}
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <p className="exam-upload-note" role="status" aria-live="polite" data-failed={failed ? "yes" : undefined}>
        {status ||
          (full
            ? ar
              ? `وصلت إلى ${MAX_TOPICS} موضوعًا.`
              : `You have reached ${MAX_TOPICS} topics.`
            : ar
              ? "صفحة واحدة في المرة. الصورة لا تُحفظ، ولا يبقى منها إلا الموضوعات."
              : "One page at a time. The photo is never stored — only the topics it gives us.")}
      </p>
    </div>
  );
}
