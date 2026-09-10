import { ArrowLeft } from "lucide-react";

interface BackIconButtonProps {
  label: string;
  onClick?: () => void;
  darkMode: boolean;
  className?: string;
  testId?: string;
}

export default function BackIconButton({
  label,
  onClick,
  darkMode,
  className = "",
  testId,
}: BackIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors ${
        darkMode ? "text-gray-200 hover:bg-gray-700" : "text-slate-700 hover:bg-gray-100"
      } ${className}`}
      onClick={onClick}
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
    </button>
  );
}
