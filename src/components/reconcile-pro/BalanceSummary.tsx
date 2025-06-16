
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, BookOpenText, Scale } from 'lucide-react';

interface BalanceSummaryProps {
  bankTotal: number;
  ziherTotal: number;
  difference: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
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
          <p className="text-2xl font-semibold text-foreground">{formatCurrency(bankTotal)}</p>
        </div>
        <div className="flex flex-col p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-center text-sm text-muted-foreground mb-1">
            <BookOpenText className="w-4 h-4 mr-2 text-primary" />
            Suma Ziher
          </div>
          <p className="text-2xl font-semibold text-foreground">{formatCurrency(ziherTotal)}</p>
        </div>
        <div className="flex flex-col p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-center text-sm text-muted-foreground mb-1">
            <Scale className="w-4 h-4 mr-2" />
            Różnica
          </div>
          <p className={`text-2xl font-semibold ${difference === 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {formatCurrency(difference)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
