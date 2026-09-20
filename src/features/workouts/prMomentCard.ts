import { PR_LABEL, type PrKind } from '@/domain/records';
import { formatDate } from '@/domain/time';
import { formatWeight, type WeightUnit } from '@/domain/units';

/**
 * PR moment card.
 *
 * Presentation over a record the app already derived (`findNewRecords`) — nothing here
 * decides what a PR is, and nothing here is persisted. The card is drawn on demand into a
 * throwaway canvas, handed to the user as a PNG, and forgotten. No new domain module, no
 * new table, no cache.
 *
 * The text layout is a pure function (`prCardFields`) so it can be tested without a canvas;
 * `drawPrMomentCard` only paints what that function produced.
 */

export const PR_CARD_WIDTH = 1080;
export const PR_CARD_HEIGHT = 1350;

export interface PrCardInput {
  kinds: readonly PrKind[];
  exerciseName: string;
  weightG?: number;
  reps?: number;
  performedAt: string;
  weightUnit: WeightUnit;
}

export interface PrCardFields {
  /** Which record fell, e.g. `HEAVIEST WEIGHT · BEST SET VOLUME`. */
  headline: string;
  exercise: string;
  /** What was lifted, e.g. `100 kg × 8`. `—` when the set carried no load or reps. */
  load: string;
  date: string;
}

/** At most two labels fit on one line at card width; the rest become a count. */
const MAX_HEADLINE_LABELS = 2;

export function prCardFields(input: PrCardInput): PrCardFields {
  const labels = input.kinds.map((kind) => PR_LABEL[kind].toUpperCase());
  const shown = labels.slice(0, MAX_HEADLINE_LABELS);
  const overflow = labels.length - shown.length;
  const headline =
    shown.length === 0
      ? 'NEW RECORD'
      : `${shown.join(' · ')}${overflow > 0 ? ` +${overflow} MORE` : ''}`;

  return {
    headline,
    exercise: input.exerciseName,
    load: formatLoad(input),
    date: formatDate(input.performedAt, { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

function formatLoad({ weightG, reps, weightUnit }: PrCardInput): string {
  const weight =
    weightG === undefined ? null : `${formatWeight(weightG, weightUnit)} ${weightUnit}`;
  if (weight && reps !== undefined) return `${weight} × ${reps}`;
  if (weight) return weight;
  if (reps !== undefined) return `${reps} rep${reps === 1 ? '' : 's'}`;
  return '—';
}

export function prCardFileName(fields: PrCardFields, date = new Date()): string {
  const slug =
    fields.exercise
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'record';
  return `lockd-pr-${slug}-${date.toISOString().slice(0, 10)}.png`;
}

export interface PrCardPalette {
  canvas: string;
  surface: string;
  ink: string;
  inkMuted: string;
  accent: string;
  line: string;
}

/** Used when the document has no resolvable theme tokens (tests, detached canvases). */
export const DEFAULT_PR_CARD_PALETTE: PrCardPalette = {
  canvas: 'rgb(10 10 11)',
  surface: 'rgb(18 17 16)',
  ink: 'rgb(246 241 232)',
  inkMuted: 'rgb(184 176 162)',
  accent: 'rgb(194 74 50)',
  line: 'rgb(64 60 54)',
};

const TOKEN_KEYS: Record<keyof PrCardPalette, string> = {
  canvas: '--rf-canvas',
  surface: '--rf-surface',
  ink: '--rf-ink',
  inkMuted: '--rf-ink-muted',
  accent: '--rf-accent',
  line: '--rf-line',
};

/** Reads the live theme so the saved card matches the app the user is looking at. */
export function readPrCardPalette(element: Element | null): PrCardPalette {
  if (!element || typeof getComputedStyle !== 'function') return DEFAULT_PR_CARD_PALETTE;
  const styles = getComputedStyle(element);
  const palette = { ...DEFAULT_PR_CARD_PALETTE };
  for (const [key, token] of Object.entries(TOKEN_KEYS) as Array<[keyof PrCardPalette, string]>) {
    const channels = styles.getPropertyValue(token).trim();
    if (channels) palette[key] = `rgb(${channels})`;
  }
  return palette;
}

export interface PrCardOptions {
  palette?: PrCardPalette;
  /** Draws the LOCKD wordmark and tagline in the footer. Opt-in, off by default. */
  stamp?: boolean;
}

export function drawPrMomentCard(
  canvas: HTMLCanvasElement,
  fields: PrCardFields,
  options: PrCardOptions = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const palette = options.palette ?? DEFAULT_PR_CARD_PALETTE;
  canvas.width = PR_CARD_WIDTH;
  canvas.height = PR_CARD_HEIGHT;

  const pad = 80;
  const inner = PR_CARD_WIDTH - pad * 2;

  ctx.fillStyle = palette.canvas;
  ctx.fillRect(0, 0, PR_CARD_WIDTH, PR_CARD_HEIGHT);

  // Inset panel, so the card still reads as a card on any wallpaper.
  ctx.fillStyle = palette.surface;
  roundedRect(ctx, pad / 2, pad / 2, PR_CARD_WIDTH - pad, PR_CARD_HEIGHT - pad, 48);
  ctx.fill();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Accent rule above the headline.
  ctx.fillStyle = palette.accent;
  ctx.fillRect(pad, 240, 132, 8);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = palette.accent;
  ctx.font = '800 38px "Barlow Condensed", Arial Narrow, sans-serif';
  fitAndFill(ctx, fields.headline, pad, 318, inner, 38, 24);

  // The exercise and load form one block, centred between the headline and the footer rule,
  // so a one-line and a two-line name are both balanced rather than one leaving a void.
  ctx.fillStyle = palette.ink;
  const exerciseLines = wrapToLines(ctx, fields.exercise, inner, 110, 62, 2, (size) => {
    ctx.font = `800 ${size}px "Barlow Condensed", Arial Narrow, sans-serif`;
  });

  const regionTop = 380;
  const regionBottom = 1090;
  const loadSize = 104;
  const gap = 100;
  const blockHeight = exerciseLines.lines.length * exerciseLines.size * 1.02 + gap + loadSize;
  let y =
    regionTop + Math.max(0, (regionBottom - regionTop - blockHeight) / 2) + exerciseLines.size;

  for (const line of exerciseLines.lines) {
    ctx.fillText(line, pad, y);
    y += exerciseLines.size * 1.02;
  }

  ctx.fillStyle = palette.ink;
  ctx.font = `700 ${loadSize}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  fitAndFill(ctx, fields.load, pad, y + gap, inner, loadSize, 52);

  ctx.fillStyle = palette.line;
  ctx.fillRect(pad, PR_CARD_HEIGHT - 230, inner, 2);

  ctx.fillStyle = palette.inkMuted;
  ctx.font = '500 34px Archivo, system-ui, sans-serif';
  ctx.fillText(fields.date, pad, PR_CARD_HEIGHT - 160);

  if (options.stamp) {
    ctx.textAlign = 'right';
    ctx.fillStyle = palette.ink;
    ctx.font = '800 40px "Barlow Condensed", Arial Narrow, sans-serif';
    ctx.fillText('LOCKD', PR_CARD_WIDTH - pad, PR_CARD_HEIGHT - 168);
    ctx.fillStyle = palette.inkMuted;
    ctx.font = '500 24px Archivo, system-ui, sans-serif';
    ctx.fillText('Keep the receipt.', PR_CARD_WIDTH - pad, PR_CARD_HEIGHT - 128);
    ctx.textAlign = 'left';
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.rect(x, y, width, height);
}

/** Shrinks until the text fits one line, then draws it. Long names never overflow the card. */
function fitAndFill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  minSize: number,
): void {
  const font = ctx.font;
  let current = size;
  while (current > minSize && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = font.replace(/\d+(\.\d+)?px/, `${current}px`);
  }
  ctx.fillText(text, x, y, maxWidth);
}

/** Wraps to at most `maxLines`, shrinking the size until the words fit. */
function wrapToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  minSize: number,
  maxLines: number,
  setFont: (size: number) => void,
): { lines: string[]; size: number } {
  let current = size;
  for (;;) {
    setFont(current);
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    const fits =
      lines.length <= maxLines && lines.every((entry) => ctx.measureText(entry).width <= maxWidth);
    if (fits || current <= minSize) {
      return { lines: lines.slice(0, maxLines), size: current };
    }
    current -= 4;
  }
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not render the card.'));
    }, 'image/png');
  });
}
