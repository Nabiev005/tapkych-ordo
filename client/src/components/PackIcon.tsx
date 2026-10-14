import { BookOpen, Brain, Calculator, FlaskConical, Gift, Globe, Landmark, Library, Mountain, Music, Palette, ScrollText, Trophy, type LucideIcon } from 'lucide-react';

/** Оюн пакетинин белгиси: базада аты сакталат (мис. 'mountain'), экранда иконка көрсөтүлөт */
export const PACK_ICON_MAP: Record<string, LucideIcon> = {
  gift: Gift,
  mountain: Mountain,
  scroll: ScrollText,
  flask: FlaskConical,
  library: Library,
  brain: Brain,
  globe: Globe,
  trophy: Trophy,
  palette: Palette,
  calculator: Calculator,
  music: Music,
  landmark: Landmark,
  book: BookOpen,
};

export function PackIcon({ name, className }: { name: string; className?: string }) {
  // Белгисиз (мис. эски эмодзи менен сакталган) белги — демейки иконка
  const Icon = PACK_ICON_MAP[name] ?? Gift;
  return <Icon className={className} />;
}
