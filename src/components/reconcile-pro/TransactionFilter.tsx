
"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from 'lucide-react';

type FilterMode = 'all' | 'income' | 'expenses';

interface TransactionFilterProps {
  currentFilterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
}

export function TransactionFilter({ currentFilterMode, onFilterChange }: TransactionFilterProps) {
  return (
    <Card className="mb-6 container mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-headline flex items-center">
          <Filter className="w-5 h-5 mr-2 text-primary" />
          Filtruj transakcje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={currentFilterMode}
          onValueChange={(value) => onFilterChange(value as FilterMode)}
          className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="filter-all" />
            <Label htmlFor="filter-all" className="cursor-pointer">Wszystko</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="income" id="filter-income" />
            <Label htmlFor="filter-income" className="cursor-pointer">Tylko wpływy</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="expenses" id="filter-expenses" />
            <Label htmlFor="filter-expenses" className="cursor-pointer">Tylko wydatki</Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
