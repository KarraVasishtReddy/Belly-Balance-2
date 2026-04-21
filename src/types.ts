export interface FoodItem {
  id: string;
  name: string;
  category: string;
  antioxidantScore: number; // mmol/100g approx
  emoji: string;
}

export type PortionType = 'palm' | 'fist' | 'handful' | 'thumb';
export type AppMode = 'balanced' | 'dieting' | 'digestion';

export interface LogEntry {
  id: string;
  foodId: string;
  portion: PortionType;
  timestamp: number;
  score: number;
  userId: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: string;
}

export const BADGES: Badge[] = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Logged your first Belly Balance entry.',
    icon: '🌱',
    requirement: '1 entry'
  },
  {
    id: 'centurion',
    title: 'Centurion',
    description: 'Logged 100 entries in your journal.',
    icon: '💯',
    requirement: '100 entries'
  },
  {
    id: 'streak-7',
    title: 'Weekly Warrior',
    description: 'Met your daily goal 7 days in a row.',
    icon: '🔥',
    requirement: '7 day streak'
  },
  {
    id: 'antioxidant-king',
    title: 'Oxidative Shield',
    description: 'Reached a daily score over 100 points.',
    icon: '🛡️',
    requirement: '100+ points in one day'
  }
];

export const PORTION_MULTIPLIERS: Record<PortionType, number> = {
  palm: 1.0,    // approx 100g
  fist: 1.5,    // approx 150g
  handful: 0.5, // approx 50g-75g
  thumb: 0.1,   // approx 10-15g
};
