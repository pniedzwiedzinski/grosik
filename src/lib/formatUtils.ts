/**
 * Utility functions for formatting and processing data
 */

import type { TransactionEntry } from '@/types/reconciliation';

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};

export const sortEntriesByDate = (entries: TransactionEntry[]): TransactionEntry[] => {
    return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const searchFilterEntries = (entries: TransactionEntry[], query: string): TransactionEntry[] => {
    if (!query.trim()) {
        return entries;
    }
    const lowerCaseQuery = query.toLowerCase();
    return entries.filter(entry =>
        entry.description.toLowerCase().includes(lowerCaseQuery) ||
        entry.amount.toString().toLowerCase().includes(lowerCaseQuery) ||
        entry.date.toLowerCase().includes(lowerCaseQuery)
    );
};
