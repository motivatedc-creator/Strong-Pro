import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock,
  Database,
  Disc3,
  Dumbbell,
  Flame,
  FlaskConical,
  History,
  Home,
  Info,
  LayoutTemplate,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Ruler,
  Search,
  Settings,
  Timer,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';

export type { LucideIcon };

export function Icon({
  icon: Glyph,
  size = 20,
  strokeWidth = 1.75,
  className,
  ...rest
}: {
  icon: LucideIcon;
  size?: number;
} & Omit<LucideProps, 'ref'>) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...rest}
    />
  );
}

export const Icons = {
  today: Home,
  routines: LayoutTemplate,
  history: History,
  analytics: FlaskConical,
  measurements: Ruler,
  tools: Wrench,
  library: Dumbbell,
  settings: Settings,
  more: MoreHorizontal,
  plus: Plus,
  minus: Minus,
  search: Search,
  trash: Trash2,
  check: Check,
  close: X,
  warning: AlertTriangle,
  chart: BarChart3,
  clock: Clock,
  database: Database,
  flame: Flame,
  chevron: ChevronRight,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  timer: Timer,
  pencil: Pencil,
  info: Info,
  alert: CircleAlert,
  plates: Disc3,
  dumbbell: Dumbbell,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
} as const;
