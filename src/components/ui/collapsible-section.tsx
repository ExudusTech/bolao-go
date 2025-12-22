import { useState, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  badge?: ReactNode;
  headerExtra?: ReactNode;
  variant?: "default" | "success" | "accent" | "primary";
}

export function CollapsibleSection({
  title,
  description,
  icon,
  children,
  defaultOpen = true,
  className,
  headerClassName,
  badge,
  headerExtra,
  variant = "default",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const borderVariants = {
    default: "",
    success: "border-success/50",
    accent: "border-accent/50",
    primary: "border-primary/50",
  };

  const titleVariants = {
    default: "",
    success: "text-success",
    accent: "text-accent",
    primary: "text-primary",
  };

  return (
    <Card className={cn("animate-fade-in transition-all", borderVariants[variant], className)}>
      <CardHeader 
        className={cn(
          "cursor-pointer select-none transition-colors hover:bg-muted/50 rounded-t-lg",
          headerClassName
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className={cn("flex items-center gap-2 text-base sm:text-lg", titleVariants[variant])}>
              {icon}
              <span className="truncate">{title}</span>
            </CardTitle>
            {description && (
              <CardDescription className="mt-1 text-sm">
                {description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            {badge}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="pt-0">
          {children}
        </CardContent>
      </div>
    </Card>
  );
}
