import type { MuscleTargetBand } from '@/domain/types';
import type { EvidenceCatalog, EvidenceClaim, EvidenceSource } from './types';

/** Product research default for weekly credited sets per muscle. Kept stable on purpose. */
export const RESEARCH_WEEKLY_SET_BAND: Readonly<MuscleTargetBand> = { min: 10, max: 20 };

/**
 * Verified sources only. Do not invent DOIs.
 * Last reviewed: 2026-09-18.
 */
export const EVIDENCE_SOURCES: readonly EvidenceSource[] = [
  {
    id: 'schoenfeld-2017-volume',
    authors: 'Schoenfeld BJ, Ogborn D, Krieger JW',
    year: 2017,
    title:
      'Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis',
    venue: 'Journal of Sports Sciences',
    doi: '10.1080/02640414.2016.1210197',
    pmid: '27433992',
    url: 'https://doi.org/10.1080/02640414.2016.1210197',
    evidenceType: 'meta_analysis',
  },
  {
    id: 'pelland-2026-dose-response',
    authors: 'Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC',
    year: 2026,
    title:
      'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains',
    venue: 'Sports Medicine',
    doi: '10.1007/s40279-025-02344-w',
    url: 'https://doi.org/10.1007/s40279-025-02344-w',
    evidenceType: 'meta_analysis',
  },
  {
    id: 'currier-2026-acsm',
    authors: 'Currier BS, et al.',
    year: 2026,
    title:
      'American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews',
    venue: 'Medicine & Science in Sports & Exercise',
    doi: '10.1249/MSS.0000000000003897',
    url: 'https://doi.org/10.1249/MSS.0000000000003897',
    evidenceType: 'position_stand',
  },
  {
    id: 'schoenfeld-2021-iusca',
    authors: 'Schoenfeld BJ, et al.',
    year: 2021,
    title:
      'Resistance Training Recommendations to Maximize Muscle Hypertrophy in an Athletic Population: Position Stand of the IUSCA',
    venue: 'International Journal of Strength and Conditioning',
    doi: '10.47206/ijsc.v1i1.81',
    url: 'https://doi.org/10.47206/ijsc.v1i1.81',
    evidenceType: 'position_stand',
  },
  {
    id: 'refalo-2023-proximity',
    authors: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ',
    year: 2023,
    title:
      'Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis',
    venue: 'Sports Medicine',
    doi: '10.1007/s40279-022-01784-y',
    url: 'https://doi.org/10.1007/s40279-022-01784-y',
    evidenceType: 'meta_analysis',
  },
  {
    id: 'epley-1985',
    authors: 'Epley B',
    year: 1985,
    title: 'Poundage Chart',
    venue: 'Boyd Epley Workout (Body Enterprises)',
    evidenceType: 'practitioner_manual',
  },
  {
    id: 'brzycki-1993',
    authors: 'Brzycki M',
    year: 1993,
    title: 'Strength Testing—Predicting a One-Rep Max from Reps-to-Fatigue',
    venue: 'Journal of Physical Education, Recreation & Dance',
    doi: '10.1080/07303084.1993.10606684',
    url: 'https://doi.org/10.1080/07303084.1993.10606684',
    evidenceType: 'practitioner_manual',
  },
];

export const EVIDENCE_CLAIMS: readonly EvidenceClaim[] = [
  {
    id: 'weekly-credited-sets-10-20',
    statement: 'A practical weekly starting band for credited working sets per muscle is 10–20.',
    kind: 'evidence_backed_default',
    behaviors: ['research_muscle_target', 'data_lab_enough_volume', 'personal_target_fallback'],
    sourceIds: [
      'schoenfeld-2017-volume',
      'pelland-2026-dose-response',
      'currier-2026-acsm',
      'schoenfeld-2021-iusca',
    ],
    support: 'partial',
    interpretation:
      'Higher weekly set volume tends to grow muscle more than lower volume, with diminishing returns. ACSM 2026 highlights about ≥10 hard sets/week among hypertrophy findings. Schoenfeld 2017 shows a graded dose-response often summarized with a 10+ bin. Pelland 2026 models volume continuously rather than as a fixed 10–20 band.',
    limitations:
      'Literature supports a positive dose-response and often a ≥10 lower region; it does not cleanly underwrite a discrete upper bound of 20. Lock’d keeps 10–20 as a stable product default so existing personal training against that band is not silently rewritten. Personal targets override it.',
    lastReviewed: '2026-09-18',
  },
  {
    id: 'secondary-set-credit-default',
    statement:
      'Secondary muscles receive a fractional credited set (default 0.5), configurable by the user.',
    kind: 'implementation_heuristic',
    behaviors: ['secondary_muscle_credit', 'attributed_volume'],
    sourceIds: ['pelland-2026-dose-response'],
    support: 'partial',
    interpretation:
      'Pelland 2026 finds fractional counting of indirect sets (0.5) fits dose-response data better than counting every indirect set as a full set. Lock’d’s default 0.5 matches that spirit for credited-set accounting, and remains user-editable.',
    limitations:
      'Fractional credit here is a product heuristic for attributed volume and credited sets, not a claim that every secondary muscle always receives half the hypertrophic stimulus of the primary.',
    lastReviewed: '2026-09-18',
  },
  {
    id: 'personal-muscle-targets',
    statement: 'Per-muscle target bands can be set by the user and override the research default.',
    kind: 'user_editable_personal',
    behaviors: ['personal_muscle_targets', 'backup_restore_targets'],
    sourceIds: ['currier-2026-acsm'],
    support: 'context',
    interpretation:
      'Position stands emphasize individualization. Personal targets are the user’s program, not a citation.',
    limitations:
      'No publication dictates a user’s saved numbers; they persist locally and via backup/restore.',
    lastReviewed: '2026-09-18',
  },
  {
    id: 'e1rm-formulas',
    statement: 'Estimated 1RM uses the Epley or Brzycki formula on completed loaded sets.',
    kind: 'pure_calculation',
    behaviors: ['e1rm_chart', 'records_e1rm'],
    sourceIds: ['epley-1985', 'brzycki-1993'],
    support: 'supports',
    interpretation:
      'Epley: weight × (1 + reps / 30). Brzycki: weight × 36 / (37 − reps). Same canonical grams in and out.',
    limitations:
      'These are estimation formulas from practitioner literature, not direct strength measurements.',
    lastReviewed: '2026-09-18',
  },
  {
    id: 'e1rm-rep-cap-12',
    statement: 'Sets above 12 reps are excluded from estimated 1RM.',
    kind: 'implementation_heuristic',
    behaviors: ['e1rm_chart', 'e1rm_rep_cap'],
    sourceIds: ['brzycki-1993'],
    support: 'partial',
    interpretation:
      "High-rep sets are useful training data but make 1RM estimates too noisy to show as strength. Brzycki's chart was aimed at lower-rep fatigue sets; Lock’d hard-caps at 12.",
    limitations:
      'The exact cap of 12 is a product reliability rule, not a universal scientific cutoff.',
    lastReviewed: '2026-09-18',
  },
  {
    id: 'tonnage-weight-times-reps',
    statement: 'Tonnage (volume) is weight × reps summed over eligible completed sets.',
    kind: 'pure_calculation',
    behaviors: ['tonnage', 'analytics_volume'],
    sourceIds: [],
    support: 'supports',
    interpretation:
      'External-load accounting only. Bodyweight, duration, distance, and assisted work are counted separately so they do not inflate tonnage.',
    limitations: 'Pure arithmetic. Not a hypertrophy prescription.',
    lastReviewed: '2026-09-18',
  },
  {
    id: 'weekly-verdict-deload-shape',
    statement:
      'Weekly Verdict treats a week as deload-shaped when hard sets fall below 60% of baseline while session count stays near baseline.',
    kind: 'implementation_heuristic',
    behaviors: ['weekly_verdict_deload'],
    sourceIds: [],
    support: 'context',
    interpretation:
      'A product rule so lighter planned weeks read as recovery rather than failure. Not a cited deload protocol.',
    limitations:
      'Thresholds (60% hard sets, session floor) are heuristics. Do not read them as sports-science diagnostic criteria.',
    lastReviewed: '2026-09-18',
  },
  {
    id: 'proximity-to-failure-context',
    statement:
      'Training near failure can matter for hypertrophy, but Lock’d does not currently prescribe an RIR target.',
    kind: 'implementation_heuristic',
    behaviors: ['future_ask_the_lab'],
    sourceIds: ['refalo-2023-proximity', 'schoenfeld-2021-iusca'],
    support: 'partial',
    interpretation:
      'Refalo 2023 finds little clear hypertrophy advantage for forcing momentary failure versus hard non-failure training when other factors are matched. Catalogued so Ask the Lab can cite the same layer later.',
    limitations: 'Not surfaced as a Data Lab recommendation yet. Included for consolidation only.',
    lastReviewed: '2026-09-18',
  },
];

export const EVIDENCE_CATALOG: EvidenceCatalog = {
  sources: EVIDENCE_SOURCES,
  claims: EVIDENCE_CLAIMS,
};
