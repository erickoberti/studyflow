import {
  BookOpen,
  Briefcase,
  Code2,
  FlaskConical,
  Globe,
  GraduationCap,
  LucideIcon,
  MonitorPlay,
  Scale,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  "code-2": Code2,
  scale: Scale,
  "flask-conical": FlaskConical,
  globe: Globe,
  "monitor-play": MonitorPlay,
};

export function StudyGuideIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = iconMap[icon] ?? BookOpen;
  return <Icon className={className} />;
}
