
"use client";

import { Button } from '@/components/ui/button';
import { Link2, Link2Off, XCircle, Banknote, BookOpenText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { TransactionEntry } from '@/types/reconciliation';

interface ActionToolbarProps {
  onManualMatch: () => void;
  onUnmatch: () => void;
  onDeselectAll: () => void;
  selectedBankEntryIds: string[];
  selectedZiherEntryIds: string[];
  bankEntries: TransactionEntry[];
  ziherEntries: TransactionEntry[];
  isProcessing: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};

export function ActionToolbar({
  onManualMatch,
  onUnmatch,
  onDeselectAll,
  selectedBankEntryIds,
  selectedZiherEntryIds,
  bankEntries,
  ziherEntries,
  isProcessing,
}: ActionToolbarProps) {
  const totalSelectedCount = selectedBankEntryIds.length + selectedZiherEntryIds.length;

  const sumSelectedBank = selectedBankEntryIds.reduce((sum, id) => {
    const entry = bankEntries.find(e => e.id === id);
    return sum + (entry ? entry.amount : 0);
  }, 0);

  const sumSelectedZiher = selectedZiherEntryIds.reduce((sum, id) => {
    const entry = ziherEntries.find(e => e.id === id);
    return sum + (entry ? entry.amount : 0);
  }, 0);

  const canManualMatch =
    selectedBankEntryIds.length > 0 &&
    selectedZiherEntryIds.length > 0 &&
    selectedBankEntryIds.every(id => bankEntries.find(e => e.id === id)?.status === 'unmatched') &&
    selectedZiherEntryIds.every(id => ziherEntries.find(e => e.id === id)?.status === 'unmatched');

  const canUnmatch = [...selectedBankEntryIds, ...selectedZiherEntryIds].some(id => {
    const bankEntry = bankEntries.find(e => e.id === id && e.status === 'matched');
    const ziherEntry = ziherEntries.find(e => e.id === id && e.status === 'matched');
    return bankEntry || ziherEntry;
  });

  return (
    <Card className="mb-6 container mx-auto shadow-md">
      <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left Side */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            onClick={onDeselectAll}
            disabled={totalSelectedCount === 0 || isProcessing}
            variant="outline"
            size="sm"
          >
            <XCircle className="mr-2 h-4 w-4" /> 
            Odznacz wszystkie ({totalSelectedCount})
          </Button>
          {totalSelectedCount > 0 && (
            <div className="flex items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center" title={`Suma zaznaczonych wpisów bankowych: ${formatCurrency(sumSelectedBank)}`}>
                <Banknote className="mr-1 h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">Bank:</span>
                <span className="ml-1">{formatCurrency(sumSelectedBank)}</span>
              </div>
              <div className="flex items-center" title={`Suma zaznaczonych wpisów Ziher: ${formatCurrency(sumSelectedZiher)}`}>
                <BookOpenText className="mr-1 h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">Ziher:</span>
                <span className="ml-1">{formatCurrency(sumSelectedZiher)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <Button
            onClick={onManualMatch}
            disabled={!canManualMatch || isProcessing}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            size="sm"
          >
            <Link2 className="mr-2 h-4 w-4" />
            Powiąż Wybrane Ręcznie
          </Button>
          <Button
            onClick={onUnmatch}
            disabled={!canUnmatch || isProcessing}
            variant="destructive"
            size="sm"
          >
            <Link2Off className="mr-2 h-4 w-4" />
            Rozłącz Wybrane
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
