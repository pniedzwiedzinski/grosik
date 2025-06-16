import { CircleDollarSign } from 'lucide-react';

export function ReconcileProHeader() {
  return (
    <header className="py-6 px-4 md:px-8 border-b border-border mb-6">
      <div className="container mx-auto flex items-center gap-3">
        <CircleDollarSign className="h-10 w-10 text-primary" />
        <h1 className="text-3xl font-headline font-semibold text-foreground">
          Grosik
        </h1>
      </div>
    </header>
  );
}
