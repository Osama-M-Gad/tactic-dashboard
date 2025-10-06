"use client";
import { VISIT_STEPS, StepKey } from "@/utils/visitStepsMap";
import { useLangTheme } from "@/hooks/useLangTheme";

type Props = {
  value: StepKey;
  onChange: (k: StepKey) => void;
  /** لو عايز تظهر مفاتيح معينة فقط (مثلاً خطوات الزيارة اللي فيها بيانات) */
  onlyKeys?: StepKey[];
};

export default function StepsToolbar({ value, onChange, onlyKeys }: Props) {
  const { isArabic } = useLangTheme();
  const keys: StepKey[] = (onlyKeys && onlyKeys.length > 0
    ? onlyKeys
    : (Object.keys(VISIT_STEPS) as StepKey[]));

  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => {
        const cfg = VISIT_STEPS[k];
        const label = isArabic ? cfg.titleAr : cfg.titleEn;
        const isActive = value === k;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`px-3 py-2 rounded-2xl border transition
              ${isActive
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                : "bg-[var(--chip-bg)] text-[var(--text)] border-[var(--divider)] hover:border-[var(--accent)]"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
