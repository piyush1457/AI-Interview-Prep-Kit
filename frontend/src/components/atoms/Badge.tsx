export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent" | "indigo";

const toneClass: Record<BadgeTone, string> = {
  neutral: "",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  accent: "badge-accent",
  indigo: "badge-indigo",
};

export default function Badge({
  tone = "neutral",
  children,
  className = "",
  title,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`badge ${toneClass[tone]} ${className}`} title={title}>
      {children}
    </span>
  );
}
