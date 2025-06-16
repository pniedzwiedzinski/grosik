
"use client";

import { Button } from '@/components/ui/button';
import { Wand2, Link2, Link2Off, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ActionToolbarProps {
  onAutoMatch: () => void;
  onManualMatch: () => void;
  onUnmatch: () => void;
  onReset: () => void;
  canAutoMatch: boolean;
  canManualMatch: boolean;
  canUnmatch: boolean;
  isProcessing: boolean;
}

export function ActionToolbar({
  onAutoMatch,
  onManualMatch,
  onUnmatch,
  onReset,
  canAutoMatch,
  canManualMatch,
  canUnmatch,
  isProcessing,
}: ActionToolbarProps) {
  return (
    <Card className="mb-6 container mx-auto shadow-md">
      <CardContent className="p-4 flex flex-wrap items-center justify-start gap-2 md:gap-4">
        <Button
          onClick={onAutoMatch}
          disabled={!canAutoMatch || isProcessing}
          variant="outline"
          className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          Uzgodnij Automatycznie
        </Button>
        <Button
          onClick={onManualMatch}
          disabled={!canManualMatch || isProcessing}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Link2 className="mr-2 h-4 w-4" />
          Uzgodnij Wybrane Ręcznie
        </Button>
        <Button
          onClick={onUnmatch}
          disabled={!canUnmatch || isProcessing}
          variant="destructive"
        >
          <Link2Off className="mr-2 h-4 w-4" />
          Rozłącz Wybrane
        </Button>
        <Button
          onClick={onReset}
          disabled={isProcessing}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground ml-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Resetuj Wszystko
        </Button>
      </CardContent>
    </Card>
  );
}
