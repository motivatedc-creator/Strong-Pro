import { EVIDENCE_CLAIMS, getClaim, type EvidenceClaim } from '@/domain/evidence';

export type AskLabMatch = {
  claim: EvidenceClaim;
  score: number;
};

export type AskLabAnswer = {
  query: string;
  matches: AskLabMatch[];
  /** Lead sentence for the UI. */
  call: string;
  /** True when nothing in the catalog matched. */
  refused: boolean;
};

type Rule = {
  claimId: string;
  needles: readonly string[];
};

const RULES: readonly Rule[] = [
  {
    claimId: 'weekly-credited-sets-10-20',
    needles: [
      '10-20',
      '10–20',
      '10 to 20',
      'weekly sets',
      'credited sets',
      'set band',
      'enough volume',
      'training enough',
      'hypertrophy volume',
      'research default',
      'muscle target',
      'why this range',
    ],
  },
  {
    claimId: 'secondary-set-credit-default',
    needles: [
      'secondary',
      '0.5',
      'half credit',
      'fractional',
      'indirect set',
      'secondary credit',
      'secondary muscle',
    ],
  },
  {
    claimId: 'personal-muscle-targets',
    needles: [
      'personal target',
      'my target',
      'my targets',
      'override',
      'custom target',
      'personal muscle',
    ],
  },
  {
    claimId: 'e1rm-formulas',
    needles: ['e1rm', 'estimated 1rm', 'one rep max', '1rm', 'epley', 'brzycki'],
  },
  {
    claimId: 'e1rm-rep-cap-12',
    needles: ['12 rep', 'rep cap', 'above 12', 'high rep', 'reps cap'],
  },
  {
    claimId: 'tonnage-weight-times-reps',
    needles: ['tonnage', 'volume is', 'weight × reps', 'weight x reps', 'how is volume'],
  },
  {
    claimId: 'weekly-verdict-deload-shape',
    needles: ['deload', 'de-load', 'weekly verdict', 'lighter week', 'recovery week'],
  },
  {
    claimId: 'proximity-to-failure-context',
    needles: ['failure', 'rir', 'proximity to failure', 'near failure', 'to failure'],
  },
];

export const ASK_LAB_STARTERS: readonly { label: string; query: string }[] = [
  { label: 'Why 10–20 sets?', query: 'Why is the research default 10–20 credited sets?' },
  { label: 'Secondary 0.5', query: 'Why do secondary muscles get 0.5 credit?' },
  { label: 'e1RM formulas', query: 'How is estimated 1RM calculated?' },
  { label: 'Deload shape', query: 'When does Weekly Verdict call a week a deload?' },
  { label: 'Personal targets', query: 'How do my personal muscle targets work?' },
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Deterministic catalog lookup — no invented sources. */
export function answerAskLab(query: string): AskLabAnswer {
  const normalized = normalize(query);
  if (!normalized) {
    return {
      query,
      matches: [],
      call: 'Ask a question about a Certified default, heuristic, formula, or personal target.',
      refused: true,
    };
  }

  const scores = new Map<string, number>();
  for (const rule of RULES) {
    let score = 0;
    for (const needle of rule.needles) {
      if (normalized.includes(needle)) score += 1;
    }
    if (score > 0) scores.set(rule.claimId, (scores.get(rule.claimId) ?? 0) + score);
  }

  for (const claim of EVIDENCE_CLAIMS) {
    const hay = normalize(`${claim.statement} ${claim.behaviors.join(' ')} ${claim.id}`);
    let bonus = 0;
    for (const token of normalized.split(' ')) {
      if (token.length < 4) continue;
      if (hay.includes(token)) bonus += 0.25;
    }
    if (bonus >= 0.75) scores.set(claim.id, (scores.get(claim.id) ?? 0) + bonus);
  }

  const matches: AskLabMatch[] = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([claimId, score]) => {
      const claim = getClaim(claimId);
      if (!claim) return null;
      return { claim, score };
    })
    .filter((row): row is AskLabMatch => row !== null);

  if (matches.length === 0) {
    return {
      query,
      matches: [],
      call: 'Not in the evidence layer. Add a catalog claim before Certified can answer this with a receipt.',
      refused: true,
    };
  }

  return {
    query,
    matches,
    call: matches[0]!.claim.statement,
    refused: false,
  };
}
