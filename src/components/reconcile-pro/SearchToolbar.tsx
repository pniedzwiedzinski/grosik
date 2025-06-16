
"use client";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from 'lucide-react';

interface SearchToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export function SearchToolbar({ searchQuery, onSearchQueryChange }: SearchToolbarProps) {
  return (
    <Card className="mb-6 container mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-headline flex items-center">
          <Search className="w-5 h-5 mr-2 text-primary" />
          Wyszukaj transakcje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          type="text"
          placeholder="Szukaj po opisie, kwocie lub dacie..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="w-full"
        />
      </CardContent>
    </Card>
  );
}
