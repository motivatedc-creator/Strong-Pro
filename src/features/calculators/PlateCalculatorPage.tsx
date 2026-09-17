import { PageHeader } from '@/components/ui';
import { PlateCalculatorPanel } from './PlateCalculatorPanel';

export function PlateCalculatorPage() {
  return (
    <>
      <PageHeader
        title="Plate calculator"
        subtitle="Enter the total barbell weight. Get the plates to load on each side."
      />
      <PlateCalculatorPanel />
      <div className="h-8" aria-hidden="true" />
    </>
  );
}
