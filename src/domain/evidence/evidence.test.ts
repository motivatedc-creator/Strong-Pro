import { describe, expect, it } from 'vitest';
import {
  assertCatalogIntegrity,
  EVIDENCE_CLAIMS,
  EVIDENCE_SOURCES,
  getClaim,
  getClaimsForBehavior,
  getSourcesForClaim,
  RESEARCH_WEEKLY_SET_BAND,
  researchMuscleTargetClaim,
} from './index';

describe('evidence catalog', () => {
  it('keeps referential integrity and the stable 10–20 research band', () => {
    expect(() => assertCatalogIntegrity()).not.toThrow();
    expect(RESEARCH_WEEKLY_SET_BAND).toEqual({ min: 10, max: 20 });
  });

  it('links the research muscle target claim to verified sources with DOIs', () => {
    const claim = researchMuscleTargetClaim();
    expect(claim.id).toBe('weekly-credited-sets-10-20');
    expect(claim.kind).toBe('evidence_backed_default');
    expect(claim.support).toBe('partial');
    expect(claim.behaviors).toContain('research_muscle_target');

    const sources = getSourcesForClaim(claim.id);
    expect(sources.length).toBeGreaterThanOrEqual(3);
    expect(sources.every((source) => Boolean(source.doi) || source.year <= 1985)).toBe(true);
    expect(sources.some((source) => source.doi === '10.1080/02640414.2016.1210197')).toBe(true);
    expect(sources.some((source) => source.doi === '10.1007/s40279-025-02344-w')).toBe(true);
    expect(sources.some((source) => source.doi === '10.1249/MSS.0000000000003897')).toBe(true);
  });

  it('labels secondary credit and deload rules as heuristics, not settled science', () => {
    expect(getClaim('secondary-set-credit-default')?.kind).toBe('implementation_heuristic');
    expect(getClaim('weekly-verdict-deload-shape')?.kind).toBe('implementation_heuristic');
    expect(getClaimsForBehavior('weekly_verdict_deload').map((c) => c.id)).toEqual([
      'weekly-verdict-deload-shape',
    ]);
    expect(getClaim('weekly-verdict-spike-flag')?.kind).toBe('implementation_heuristic');
    expect(getClaim('training-stall-flag')?.kind).toBe('implementation_heuristic');
    expect(getSourcesForClaim('weekly-verdict-spike-flag')).toHaveLength(0);
    expect(getSourcesForClaim('training-stall-flag')).toHaveLength(0);
  });

  it('marks e1RM formulas as pure calculation and the 12-rep cap as a heuristic', () => {
    expect(getClaim('e1rm-formulas')?.kind).toBe('pure_calculation');
    expect(getClaim('e1rm-rep-cap-12')?.kind).toBe('implementation_heuristic');
    expect(getClaim('tonnage-weight-times-reps')?.kind).toBe('pure_calculation');
  });

  it('exposes personal targets as user-editable, not research defaults', () => {
    expect(getClaim('personal-muscle-targets')?.kind).toBe('user_editable_personal');
    expect(EVIDENCE_SOURCES.length).toBeGreaterThanOrEqual(5);
    expect(EVIDENCE_CLAIMS.length).toBeGreaterThanOrEqual(6);
  });
});
