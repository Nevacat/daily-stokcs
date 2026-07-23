import {
  BatteryCharging,
  Car,
  Clapperboard,
  Cpu,
  Flame,
  Landmark,
  Pill,
  Shield,
} from 'lucide-react-native';
import type { Sector } from '@daily-stocks/shared';

/** 섹터별 lucide 아이콘 */
export const SECTOR_ICONS: Record<Sector, typeof Cpu> = {
  semiconductor_ai: Cpu,
  battery: BatteryCharging,
  bio_healthcare: Pill,
  automotive: Car,
  finance: Landmark,
  entertainment: Clapperboard,
  defense_shipbuilding: Shield,
  energy_chemical: Flame,
};
