import { useId, type ReactNode } from "react";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Select({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  optionLabels?: Partial<Record<string, string>>;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field label={label}>
      <select
        id={id}
        name={label}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? humanize(option)}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .replace(/^./, (c) => c.toUpperCase());
}
