"use client";

import { useState } from "react";
import { ClipboardList, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MAX_TOPICS,
  TOPIC_CONFIDENCES,
  TOPIC_WEIGHTS,
  parseVisionTopics,
  type ExamTopic,
  type TopicConfidence,
  type TopicWeight,
} from "@/lib/exam-plans/topics";

/**
 * The professional way in: one row per topic, with the two judgements only the student can make.
 *
 * A textarea cannot say "this chapter is huge and I am shaky on it", and that is exactly what a plan
 * needs to know -- so weight and confidence are fields, not adjectives buried in prose. Pasting is
 * still supported, as a bulk import that becomes rows, because a syllabus usually starts life as
 * text somebody else wrote.
 */

/** A row carries a stable key so removing the third row does not move focus into the fourth. */
export type TopicRow = ExamTopic & { key: string };

export function newTopicRow(topic: Partial<ExamTopic> = {}): TopicRow {
  return {
    key: globalThis.crypto.randomUUID(),
    title: topic.title ?? "",
    chapter: topic.chapter ?? null,
    weight: topic.weight ?? "NORMAL",
    confidence: topic.confidence ?? "OK",
  };
}

export function topicRows(topics: ExamTopic[]) {
  return topics.map((topic) => newTopicRow(topic));
}

/** Rows worth sending: a blank row the student added and never filled in is not an error. */
export function filledTopics(rows: TopicRow[]): ExamTopic[] {
  return rows.flatMap((row) => {
    const title = row.title.trim();
    // Listed field by field rather than spread-minus-`key`: `key` is React's identity for the row and
    // has no business in a request body, and naming the four fields is what keeps it out.
    return title.length >= 2
      ? [{ title, chapter: row.chapter, weight: row.weight, confidence: row.confidence }]
      : [];
  });
}

const WEIGHT_LABEL: Record<TopicWeight, { en: string; ar: string }> = {
  LIGHT: { en: "Light", ar: "خفيف" },
  NORMAL: { en: "Normal", ar: "عادي" },
  HEAVY: { en: "Heavy", ar: "كثيف" },
};

const CONFIDENCE_LABEL: Record<TopicConfidence, { en: string; ar: string }> = {
  WEAK: { en: "Shaky", ar: "ضعيف" },
  OK: { en: "Getting there", ar: "مقبول" },
  STRONG: { en: "Solid", ar: "قوي" },
};

export function TopicComposer({
  ar,
  rows,
  onChange,
  disabled = false,
}: {
  ar: boolean;
  rows: TopicRow[];
  onChange: (rows: TopicRow[]) => void;
  disabled?: boolean;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const filled = filledTopics(rows);
  const heavy = filled.filter((topic) => topic.weight === "HEAVY").length;
  const shaky = filled.filter((topic) => topic.confidence === "WEAK").length;
  const room = MAX_TOPICS - rows.length;

  function update(key: string, change: Partial<ExamTopic>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  function addRow() {
    if (room < 1) return;
    onChange([...rows, newTopicRow()]);
  }

  function importPasted() {
    // The same reader the photo scanner uses: it already strips bullets, numbering and page
    // numbers, and promotes "Chapter 3" style lines to a chapter -- so a pasted فهرس and a
    // photographed one arrive as the same rows.
    const { topics } = parseVisionTopics(pasted);
    if (!topics.length) return;
    const keep = rows.filter((row) => row.title.trim().length >= 2);
    onChange([...keep, ...topicRows(topics)].slice(0, MAX_TOPICS));
    setPasted("");
    setPasteOpen(false);
  }

  return (
    <div className="exam-topic-composer">
      <div className="exam-topic-toolbar">
        <p className="exam-topic-readout" role="status" aria-live="polite">
          {ar
            ? `${filled.length} موضوعًا · ${heavy} كثيف · ${shaky} ضعيف`
            : `${filled.length} topic${filled.length === 1 ? "" : "s"} · ${heavy} heavy · ${shaky} shaky`}
        </p>
        <div className="exam-topic-toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            leftIcon={<ClipboardList className="w-4 h-4" />}
            onClick={() => setPasteOpen((open) => !open)}
          >
            {ar ? "لصق قائمة" : "Paste a list"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled || room < 1}
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={addRow}
          >
            {ar ? "موضوع" : "Topic"}
          </Button>
        </div>
      </div>

      {pasteOpen && (
        <div className="exam-topic-paste">
          <label className="ui-label">
            {ar ? "الصق الفصول أو الموضوعات، سطرًا لكل موضوع" : "Paste chapters or topics, one per line"}
            <textarea
              className="ui-textarea"
              rows={5}
              value={pasted}
              disabled={disabled}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={
                ar
                  ? "الباب الأول: القلب\n- هبوط القلب ....... ٤٢\n- اضطراب النظم"
                  : "Chapter 1: Cardiology\n- Heart failure ....... 42\n- Arrhythmias"
              }
            />
          </label>
          <div className="exam-topic-paste-actions">
            <Button
              variant="primary"
              size="sm"
              disabled={disabled || !pasted.trim()}
              leftIcon={<Wand2 className="w-4 h-4" />}
              onClick={importPasted}
            >
              {ar ? "تحويل إلى صفوف" : "Turn into rows"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPasteOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
          </div>
        </div>
      )}

      {rows.length ? (
        <ul className="exam-topic-list">
          {rows.map((row, index) => (
            <li className="exam-topic-card" key={row.key} data-weight={row.weight.toLowerCase()}>
              <div className="exam-topic-main">
                <input
                  className="ui-input exam-topic-title"
                  value={row.title}
                  maxLength={160}
                  disabled={disabled}
                  aria-label={ar ? `الموضوع ${index + 1}` : `Topic ${index + 1}`}
                  placeholder={ar ? "اسم الموضوع" : "Topic name"}
                  onChange={(event) => update(row.key, { title: event.target.value })}
                />
                <button
                  type="button"
                  className="exam-topic-remove"
                  disabled={disabled}
                  aria-label={
                    ar ? `إزالة ${row.title || index + 1}` : `Remove ${row.title || index + 1}`
                  }
                  onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}
                >
                  <Trash2 aria-hidden="true" className="w-4 h-4" />
                </button>
              </div>
              <div className="exam-topic-fields">
                <input
                  className="ui-input"
                  value={row.chapter ?? ""}
                  maxLength={80}
                  disabled={disabled}
                  aria-label={ar ? "الباب" : "Chapter"}
                  placeholder={ar ? "الباب (اختياري)" : "Chapter (optional)"}
                  onChange={(event) => update(row.key, { chapter: event.target.value || null })}
                />
                <select
                  className="ui-input"
                  value={row.weight}
                  disabled={disabled}
                  aria-label={ar ? "حجم الموضوع" : "Topic size"}
                  onChange={(event) =>
                    update(row.key, { weight: event.target.value as TopicWeight })
                  }
                >
                  {TOPIC_WEIGHTS.map((weight) => (
                    <option key={weight} value={weight}>
                      {ar ? WEIGHT_LABEL[weight].ar : WEIGHT_LABEL[weight].en}
                    </option>
                  ))}
                </select>
                <select
                  className="ui-input"
                  value={row.confidence}
                  disabled={disabled}
                  aria-label={ar ? "مستواك فيه" : "How you feel about it"}
                  onChange={(event) =>
                    update(row.key, { confidence: event.target.value as TopicConfidence })
                  }
                >
                  {TOPIC_CONFIDENCES.map((confidence) => (
                    <option key={confidence} value={confidence}>
                      {ar ? CONFIDENCE_LABEL[confidence].ar : CONFIDENCE_LABEL[confidence].en}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">
          {ar
            ? "أضف موضوعًا، أو الصق قائمة، أو صوّر فهرس الكتاب."
            : "Add a topic, paste a list, or photograph the book's index."}
        </p>
      )}

      {room < 1 && (
        <p className="muted-copy">
          {ar ? `الحد الأقصى ${MAX_TOPICS} موضوعًا.` : `That is the maximum of ${MAX_TOPICS} topics.`}
        </p>
      )}
    </div>
  );
}
