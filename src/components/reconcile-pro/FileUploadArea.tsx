
"use client";

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UploadCloud, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadAreaProps {
  onFilesProcessed: (bankFile: File | null, ziherFile: File | null) => void;
}

export function FileUploadArea({ onFilesProcessed }: FileUploadAreaProps) {
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [ziherFile, setZiherFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'bank' | 'ziher') => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv') {
        toast({
          title: 'Nieprawidłowy typ pliku',
          description: 'Proszę przesłać plik CSV.',
          variant: 'destructive',
        });
        event.target.value = ''; 
        return;
      }
      if (type === 'bank') {
        setBankFile(file);
      } else {
        setZiherFile(file);
      }
    }
  };

  const handleSubmit = () => {
    if (!bankFile && !ziherFile) {
      toast({
        title: 'Nie wybrano plików',
        description: 'Proszę przesłać co najmniej jeden plik CSV do przetworzenia.',
        variant: 'destructive',
      });
      return;
    }
    onFilesProcessed(bankFile, ziherFile);
  };

  const FileInput = ({ id, label, file, onChange }: { id: string, label: string, file: File | null, onChange: (e: ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground/80 flex items-center gap-2">
        <UploadCloud className="w-5 h-5 text-primary" />
        {label}
      </Label>
      <Input
        id={id}
        type="file"
        accept=".csv"
        onChange={onChange}
        className="file:text-primary file:font-semibold hover:file:bg-primary/10 transition-colors"
      />
      {file && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
          <FileText className="w-3 h-3" /> {file.name} ({(file.size / 1024).toFixed(2)} KB)
        </p>
      )}
    </div>
  );

  return (
    <Card className="mb-6 container mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-headline">Sprawdź rozliczenie</CardTitle>
        <CardDescription>Gdzieś brakuje grosika? Albo kilku? Prześlij historię z banku i plik ZiHeRa w formacie CSV, żeby sprawdzić gdzie się niezgadzają.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <FileInput id="bank-csv" label="Historia z banku CSV" file={bankFile} onChange={(e) => handleFileChange(e, 'bank')} />
          <FileInput id="ziher-csv" label="Plik CSV z ZiHeRa" file={ziherFile} onChange={(e) => handleFileChange(e, 'ziher')} />
        </div>
        <Button onClick={handleSubmit} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
          Przetwórz Pliki
        </Button>
      </CardContent>
    </Card>
  );
}

