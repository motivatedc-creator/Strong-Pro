import { PageHeader } from '@/components/ui';
import { PlateCalculatorPanel } from './PlateCalculatorPanel';

export function PlateCalculatorPage() {
  return (
    <>
      <PageHeader
        title="Plate calculator"
        subtitle="Exact per-side loading, or the closest achievable weight below your target."
      />
      <PlateCalculatorPanel />
      <div className="h-8" aria-hidden="true" />
    </>
  );
}
