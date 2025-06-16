
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, BookOpenText, Scale } from 'lucide-react';

interface BalanceSummaryProps {
  bankTotal: number;
  ziherTotal: number;
  difference: number;
}

// A number is effectively zero if its absolute value is less than half of the smallest currency unit (e.g., 0.005 for PLN)
// This handles floating point inaccuracies that might result in values like -0.00000001.
const isEffectivelyZero = (amount: number): boolean => {
  return Math.abs(amount) < 0.005; 
};

const formatCurrency = (amount: number) => {
  // If the amount is effectively zero, format 0 to avoid displaying "-0,00 zł"
  const displayAmount = isEffectivelyZero(amount) ? 0 : amount;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(displayAmount);
};


export function BalanceSummary({ bankTotal, ziherTotal, difference }: BalanceSummaryProps) {
  return (
    <Card className="mb-6 container mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-headline">Podsumowanie Finansowe</CardTitle>
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

