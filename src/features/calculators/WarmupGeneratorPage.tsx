import { PageHeader } from '@/components/ui';
import { WarmupPanel } from './WarmupPanel';

export function WarmupGeneratorPage() {
  return (
    <>
      <PageHeader
        title="Warm-up generator"
        subtitle="An editable ramp to your working weight. Open it inside a workout to insert the sets directly."
      />
      <WarmupPanel />
      <div className="h-8" aria-hidden="true" />
    </>
  );
}
