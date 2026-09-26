"use client";

import { Markdown } from "@/components/Markdown";

export interface ClientQuestionView {
  id: string;
  topicId: string;
  type: "mcq_single" | "mcq_multi" | "numerical" | "integer" | "matching";
  difficulty: string;
  expectedSeconds: number;
  stem: string;
  options: { key: string; text: string }[] | null;
  optionOrder: string[] | null;
  matchingKeys: string[] | null;
}

export type AnswerValue = string | string[] | number | Record<string, string> | undefined;

export function QuestionCard({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ClientQuestionView;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{question.type.replace("_", " ")}</span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{question.difficulty}</span>
      </div>

      <Markdown>{question.stem}</Markdown>

      <div className="mt-4 space-y-2">
        {question.type === "mcq_single" &&
          question.options?.map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                value === opt.key ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                disabled={disabled}
                checked={value === opt.key}
                onChange={() => onChange(opt.key)}
                className="mt-0.5"
              />
              <span>
                <b>{opt.key}.</b> {opt.text}
              </span>
            </label>
          ))}

        {question.type === "mcq_multi" &&
          question.options?.map((opt) => {
            const selected = Array.isArray(value) ? value : [];
            const checked = selected.includes(opt.key);
            return (
              <label
                key={opt.key}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  checked ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={() => {
                    const next = checked ? selected.filter((k) => k !== opt.key) : [...selected, opt.key];
                    onChange(next);
                  }}
                  className="mt-0.5"
                />
                <span>
                  <b>{opt.key}.</b> {opt.text}
                </span>
              </label>
            );
          })}

        {(question.type === "numerical" || question.type === "integer") && (
          <input
            type="number"
            disabled={disabled}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder={question.type === "integer" ? "Single digit 0-9" : "Numeric answer"}
            className="w-full max-w-xs rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        )}

        {question.type === "matching" && question.matchingKeys && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Type the matching Column II label for each item, as shown above.</p>
            {question.matchingKeys.map((key) => {
              const current = typeof value === "object" && value && !Array.isArray(value) ? (value as Record<string, string>) : {};
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-6 text-sm font-medium">{key}</span>
                  <input
                    type="text"
                    disabled={disabled}
                    value={current[key] ?? ""}
                    onChange={(e) => onChange({ ...current, [key]: e.target.value })}
                    className="w-24 rounded-lg border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
