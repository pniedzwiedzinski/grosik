import { FileUploadArea } from '@/components/reconcile-pro/FileUploadArea';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileWarning } from 'lucide-react';

interface FileUploadViewProps {
    onFilesProcessed: (bankFile: File, ziherFile: File) => Promise<void>;
}

export function FileUploadView({ onFilesProcessed }: FileUploadViewProps) {
    return (
        <>
            <FileUploadArea onFilesProcessed={onFilesProcessed} />
            <Alert className="mt-6">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Skąd wziąć pliki CSV?</AlertTitle>
                <AlertDescription>
                    W książce bankowej w ZiHeRze znajdziesz przycisk do pobierania CSV.
                    W iBiznesie musisz wejść w historię → wybrać zakres dat dla twojego rozliczenia →
                    kliknąć eksportuj historię i wybrać format CSV.
                </AlertDescription>
            </Alert>
        </>
    );
}
