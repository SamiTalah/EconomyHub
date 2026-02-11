import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthYear, getPreviousMonth } from '../../utils/formatters';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
}

function getNextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(getPreviousMonth(value))}
        className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-medium text-surface-700 min-w-[140px] text-center capitalize">
        {formatMonthYear(value)}
      </span>
      <button
        onClick={() => onChange(getNextMonth(value))}
        className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
