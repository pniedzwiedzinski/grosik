import { Progress } from "@/components/ui/progress";

interface ProcessingProgressProps {
    progress: number;
}

export function ProcessingProgress({ progress }: ProcessingProgressProps) {
    return (
        <div className="my-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground mt-2">
                Przetwarzanie... {progress.toFixed(0)}%
            </p>
        </div>
    );
}
