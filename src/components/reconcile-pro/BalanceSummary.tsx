
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Banknote, BookOpenText, Scale, Trash2 } from 'lucide-react';

interface BalanceSummaryProps {
  bankTotal: number;
  ziherTotal: number;
  difference: number;
  onReset: () => void;
  isProcessing: boolean;
}

const isEffectivelyZero = (amount: number): boolean => {
  return Math.abs(amount) < 0.005; 
};

const formatCurrency = (amount: number) => {
  const displayAmount = isEffectivelyZero(amount) ? 0 : amount;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(displayAmount);
};


export function BalanceSummary({ bankTotal, ziherTotal, difference, onReset, isProcessing }: BalanceSummaryProps) {
  return (
    <Card className="mb-6 container mx-auto shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-headline">Podsumowanie Finansowe</CardTitle>
        <Button
          onClick={onReset}
          disabled={isProcessing}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Wczytaj ponownie pliki
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-center text-sm text-muted-foreground mb-1">
            <Banknote className="w-4 h-4 mr-2 text-primary" />
            Suma Bank
          </div>
          <p className={`text-2xl font-semibold ${isEffectivelyZero(bankTotal) ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
            {formatCurrency(bankTotal)}
          </p>
        </div>
        <div className="flex flex-col p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-center text-sm text-muted-foreground mb-1">
            <BookOpenText className="w-4 h-4 mr-2 text-primary" />
            Suma Ziher
          </div>
          <p className={`text-2xl font-semibold ${isEffectivelyZero(ziherTotal) ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
            {formatCurrency(ziherTotal)}
          </p>
        </div>
        <div className="flex flex-col p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-center text-sm text-muted-foreground mb-1">
            <Scale className="w-4 h-4 mr-2" />
            Różnica
          </div>
          <p className={`text-2xl font-semibold ${isEffectivelyZero(difference) ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {formatCurrency(difference)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
