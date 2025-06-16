
"use client";

import { Button } from '@/components/ui/button';
import { Link2, Link2Off } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ActionToolbarProps {
  onManualMatch: () => void;
  onUnmatch: () => void;
  canManualMatch: boolean;
  canUnmatch: boolean;
  isProcessing: boolean;
}

export function ActionToolbar({
  onManualMatch,
  onUnmatch,
  canManualMatch,
  canUnmatch,
  isProcessing,
}: ActionToolbarProps) {
  return (
    <Card className="mb-6 container mx-auto shadow-md">
      <CardContent className="p-4 flex flex-wrap items-center justify-start gap-2 md:gap-4">
        <Button
          onClick={onManualMatch}
          disabled={!canManualMatch || isProcessing}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Link2 className="mr-2 h-4 w-4" />
          Powiąż Wybrane Ręcznie
        </Button>
        <Button
          onClick={onUnmatch}
          disabled={!canUnmatch || isProcessing}
          variant="destructive"
        >
          <Link2Off className="mr-2 h-4 w-4" />
          Rozłącz Wybrane
        </Button>
      </CardContent>
    </Card>
  );
}
