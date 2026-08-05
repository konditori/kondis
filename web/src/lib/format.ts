import { Bike, Dumbbell, Footprints, Mountain, PersonStanding, Waves } from '@lucide/svelte';

export function activityName(activity: { name: string | null; sport: string }): string {
  if (activity.name) return activity.name;
  return activity.sport.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function sportIcon(sport: string) {
  const normalized = sport.toLowerCase();
  if (normalized.includes('cycl') || normalized.includes('bike')) return Bike;
  if (normalized.includes('run') || normalized.includes('walk')) return Footprints;
  if (normalized.includes('swim')) return Waves;
  if (normalized.includes('hike') || normalized.includes('mountain')) return Mountain;
  if (normalized.includes('strength') || normalized.includes('training')) return Dumbbell;
  return PersonStanding;
}

export function distance(value: number | null): string {
  return value == null ? '—' : `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} km`;
}

export function duration(seconds: number | null): string {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes} min`;
}

export function speed(value: number | null): string {
  return value == null ? '—' : `${(value * 3.6).toFixed(1)} km/h`;
}

export function localDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(value),
  );
}

export function localTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
