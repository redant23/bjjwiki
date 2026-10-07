import {
  ArrowDownToLine,
  DoorOpen,
  Dumbbell,
  Folder,
  Footprints,
  Layers,
  Lock,
  RefreshCw,
  Shield,
  Shuffle,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryIconKey } from '@/lib/technique-cards';

// 루트 분류 아이콘 (카테고리 카드, 홈 카테고리 바로가기에서 함께 사용)
export const CATEGORY_ICONS: Record<CategoryIconKey, LucideIcon> = {
  standing: ArrowDownToLine,
  guard: Shield,
  pass: Footprints,
  position: Layers,
  submission: Lock,
  escape: DoorOpen,
  drill: Dumbbell,
  transition: Shuffle,
  sweep: RefreshCw,
  other: Folder,
};
