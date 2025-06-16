
"use client";

import type { TransactionEntry, MatchGroup } from '@/types/reconciliation';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Info, Banknote, BookOpenText, CheckCircle2, Search } from 'lucide-react';

interface TransactionTableProps {
  title: string;
  entries: TransactionEntry[];
  selectedIds: string[];
  onRowSelect: (id: string, isSelected: boolean) => void;
  isProcessing: boolean;
  matchGroups: MatchGroup[];
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  canSelectAny: boolean;
  isGloballyReconciled?: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
}

const statusTranslations: Record<string, string> = { 
  matched: 'Dopasowane',
  unmatched: 'Niedopasowane',
  candidate: 'Kandydat',
};


export function TransactionTable({
  title,
  entries,
  selectedIds,
  onRowSelect,
  isProcessing,
  matchGroups,
  isAllSelected,
  onToggleSelectAll,
  canSelectAny,
  isGloballyReconciled,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
}: TransactionTableProps) {
  
  const getRowStyle = (entry: TransactionEntry) => {
    if (entry.status === 'matched' && entry.matchId) {
      const match = matchGroups.find(mg => mg.id === entry.matchId);
      if (match && match.isDiscrepancy) {
        return 'bg-yellow-100 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-200/50 dark:hover:bg-yellow-800/50';
      }
      return 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 hover:bg-green-200/50 dark:hover:bg-green-800/50';
    }
    if (entry.status === 'candidate') {
      return 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700/50 hover:bg-blue-100/50 dark:hover:bg-blue-800/50';
    }
    return 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-700/50 hover:bg-red-100/50 dark:hover:bg-red-800/50';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
  };

  const getAmountDisplay = (entry: TransactionEntry) => {
    if (entry.status === 'matched' && entry.matchId) {
      const match = matchGroups.find(mg => mg.id === entry.matchId);
      if (match && match.isDiscrepancy) {
        const otherSourceSum = entry.source === 'bank' ? match.ziherSumInMatch : match.bankSumInMatch;
        const otherSourceLabel = entry.source === 'bank' ? 'Ziher' : 'Bank';
        return (
          <>
            {formatCurrency(entry.amount)}
            <span className="text-xs text-muted-foreground ml-1">
              ({otherSourceLabel}: {formatCurrency(otherSourceSum)})
            </span>
          </>
        );
      }
    }
    return formatCurrency(entry.amount);
  };


  return (
    <Card className="shadow-lg flex flex-col h-full">
      <CardHeader className="flex flex-col space-y-3 pb-3 pt-4 px-4 md:px-6">
        <div className="flex flex-row items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {title.toLowerCase().includes("bank") ? (
              <Banknote className="w-5 h-5 text-primary" />
            ) : title.toLowerCase().includes("ziher") ? (
              <BookOpenText className="w-5 h-5 text-primary" />
            ) : (
              <Info className="w-5 h-5 text-primary" />
            )}
            <CardTitle className="text-lg font-headline">{title}</CardTitle>
            <Badge variant="secondary">{entries.length}</Badge>
          </div>
        </div>
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full rounded-lg bg-background pl-8 h-9"
            disabled={isProcessing}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <ScrollArea className="h-[400px]">
          {entries.length === 0 && !isProcessing ? (
            isGloballyReconciled &&
            title.toLowerCase().includes("niedopasowane") ? (
              <div className="p-6 text-center text-green-600 dark:text-green-400 font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Sukces! Wpisy w ZiHeRze zgadzają się z bankiem!
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                Brak transakcji do wyświetlenia.
              </div>
            )
          ) : isProcessing && entries.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Przetwarzanie...
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={onToggleSelectAll}
                      disabled={!canSelectAny || isProcessing}
                      aria-label="Zaznacz wszystko"
                    />
                  </TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                  {title.toLowerCase().includes("niedopasowane") && (
                    <TableHead>Źródło</TableHead>
                  )}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={`transition-colors duration-200 ${getRowStyle(
                      entry
                    )} ${
                      selectedIds.includes(entry.id)
                        ? "ring-2 ring-accent ring-inset"
                        : ""
                    }`}
                    onClick={() =>
                      onRowSelect(entry.id, !selectedIds.includes(entry.id))
                    }
                    aria-selected={selectedIds.includes(entry.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(entry.id)}
                        onCheckedChange={(checked) =>
                          onRowSelect(entry.id, !!checked)
                        }
                        aria-label={`Zaznacz transakcję ${entry.description}`}
                        disabled={
                          (entry.status === "matched" &&
                            title.toLowerCase().includes("niedopasowane")) ||
                          isProcessing
                        }
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {entry.date}
                    </TableCell>
                    <TableCell
                      className="max-w-[150px] md:max-w-[200px] truncate"
                      title={entry.description}
                    >
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {getAmountDisplay(entry)}
                    </TableCell>
                    {title.toLowerCase().includes("niedopasowane") && (
                      <TableCell>
                        <Badge
                          variant={
                            entry.source === "bank" ? "default" : "secondary"
                          }
                        >
                          {entry.source}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      {entry.status === "matched" &&
                      entry.matchedEntryDetails &&
                      entry.matchedEntryDetails.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-green-600 dark:text-green-400 hover:underline"
                            >
                              {statusTranslations["matched"]}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 text-sm">
                            <div className="grid gap-2">
                              <p className="font-semibold">Dopasowano z:</p>
                              {entry.matchedEntryDetails.map((detail) => (
                                <div
                                  key={detail.id}
                                  className="border-t pt-2 mt-1"
                                >
                                  <p>
                                    <strong>Opis:</strong> {detail.description}
                                  </p>
                                  <p>
                                    <strong>Data:</strong> {detail.date}
                                  </p>
                                  <p>
                                    <strong>Kwota:</strong>{" "}
                                    {formatCurrency(detail.amount || 0)}
                                  </p>
                                  <p>
                                    <strong>Źródło:</strong> {detail.source}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Badge
                          variant={
                            entry.status === "unmatched"
                              ? "destructive"
                              : entry.status === "candidate"
                              ? "default"
                              : "outline"
                          }
                          className="capitalize"
                          style={
                            entry.status === "candidate"
                              ? {
                                  backgroundColor: "hsl(var(--primary))",
                                  color: "hsl(var(--primary-foreground))",
                                }
                              : {}
                          }
                        >
                          {statusTranslations[entry.status] || entry.status}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

