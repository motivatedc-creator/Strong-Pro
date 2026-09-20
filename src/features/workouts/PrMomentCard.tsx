import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/app/store';
import { Button, Sheet, Toggle } from '@/components/ui';
import {
  PR_CARD_HEIGHT,
  PR_CARD_WIDTH,
  canvasToPngBlob,
  drawPrMomentCard,
  prCardFields,
  prCardFileName,
  readPrCardPalette,
  type PrCardInput,
} from './prMomentCard';
import { shareOrDownloadFile } from '@/platform/share';

/** The faces `drawPrMomentCard` paints with. Sizes are irrelevant to which face loads. */
const CARD_FONTS = [
  '800 110px "Barlow Condensed"',
  '700 104px "IBM Plex Mono"',
  '500 34px Archivo',
];

/**
 * The one moment worth taking off the device on purpose.
 *
 * Opened by tap, drawn on demand, never pre-rendered or stored. Closing without saving
 * leaves nothing behind: the canvas belongs to this component and dies with it.
 */
export function PrMomentCard({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: PrCardInput;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stamp, setStamp] = useState(true);
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => prCardFields(record), [record]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawPrMomentCard(canvas, fields, {
      palette: readPrCardPalette(document.documentElement),
      stamp,
    });
  }, [fields, stamp]);

  useEffect(() => {
    if (!open) return;
    paint();
    // A canvas draw does not trigger a web-font fetch, and `fonts.ready` only waits for
    // faces the page already asked for — so request each face the card uses, then redraw.
    // Without this the PNG silently ships in the fallback family.
    let cancelled = false;
    void Promise.all(CARD_FONTS.map((font) => document.fonts?.load(font)))
      .then(() => {
        if (!cancelled) paint();
      })
      .catch(() => {
        // Fallback families already painted; a missing face is not worth an error.
      });
    return () => {
      cancelled = true;
    };
  }, [open, paint]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await canvasToPngBlob(canvas);
      const name = prCardFileName(fields);
      const result = await shareOrDownloadFile(
        new File([blob], name, { type: 'image/png' }),
        `${fields.exercise} — ${fields.load}`,
      );
      if (result === 'downloaded') toast.success('Card saved.');
      if (result === 'shared') onClose();
    } catch {
      toast.error('Could not create the card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="PR card"
      description="Made on this device when you tap save. Nothing is uploaded or kept."
      footer={
        <Button variant="primary" block onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save image'}
        </Button>
      }
    >
      <canvas
        ref={canvasRef}
        width={PR_CARD_WIDTH}
        height={PR_CARD_HEIGHT}
        role="img"
        aria-label={`${fields.headline}. ${fields.exercise}, ${fields.load}, ${fields.date}.`}
        className="mx-auto w-full max-w-xs rounded-xl border border-line"
      />
      <div className="mt-3">
        <Toggle
          checked={stamp}
          onChange={setStamp}
          label="LOCKD mark"
          description="Adds the wordmark and tagline in the corner."
        />
      </div>
    </Sheet>
  );
}
