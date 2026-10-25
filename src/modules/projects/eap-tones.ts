/**
 * Cores semânticas da EAP sobre os tokens do design system.
 * Impedimento é âmbar e atraso é vermelho; ambos sempre acompanham texto e ícone.
 */
export const impedimentTone = {
  text: "text-warning-foreground",
  surface: "border-warning/50 bg-warning/10",
  icon: "bg-warning/25 text-warning-foreground",
  rail: "bg-warning",
};

export const cancelTone = {
  surface: "border-muted-foreground/30 bg-muted",
  icon: "bg-muted-foreground/15 text-muted-foreground",
};

export const overdueTone = {
  text: "text-destructive",
  surface: "border-destructive/25 bg-destructive/[0.04]",
  icon: "bg-destructive/10 text-destructive",
  rail: "bg-destructive",
};
