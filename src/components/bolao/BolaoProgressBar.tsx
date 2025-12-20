import { cn } from "@/lib/utils";
import { BOLAO_STAGES, BolaoStatusInfo } from "@/lib/bolao-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BolaoProgressBarProps {
  statusInfo: BolaoStatusInfo;
  className?: string;
}

export function BolaoProgressBar({ statusInfo, className }: BolaoProgressBarProps) {
  const { step, label, icon } = statusInfo;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("w-full", className)}>
            {/* Progress bar container */}
            <div className="relative h-6 bg-muted rounded-full overflow-hidden flex">
              {BOLAO_STAGES.map((stage, index) => {
                const stageNumber = index + 1;
                const isCompleted = step > stageNumber;
                const isCurrent = step === stageNumber;
                const isLast = index === BOLAO_STAGES.length - 1;

                return (
                  <div
                    key={stage.key}
                    className={cn(
                      "flex-1 flex items-center justify-center relative transition-all duration-500",
                      isCompleted && "bg-success",
                      isCurrent && step < 4 && "bg-primary",
                      isCurrent && step === 4 && "bg-success",
                      !isLast && "border-r border-background/50"
                    )}
                  >
                    {/* Stage indicator */}
                    <span
                      className={cn(
                        "text-xs font-medium z-10 transition-colors duration-300",
                        (isCompleted || isCurrent) ? "text-white" : "text-muted-foreground"
                      )}
                    >
                      {isCurrent ? icon : isCompleted ? "✓" : stageNumber}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Current status label */}
            <p className="text-xs text-muted-foreground mt-1 text-center truncate">
              {icon} {label}
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{icon} {label}</p>
            <div className="flex gap-1 text-xs text-muted-foreground">
              {BOLAO_STAGES.map((stage, index) => (
                <span key={stage.key} className="flex items-center gap-0.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    step > index + 1 ? "bg-success" : 
                    step === index + 1 ? "bg-primary" : "bg-muted"
                  )} />
                  {stage.label}
                  {index < BOLAO_STAGES.length - 1 && " →"}
                </span>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
