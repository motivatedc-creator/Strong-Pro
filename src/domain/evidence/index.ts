import {
  EVIDENCE_CATALOG,
  EVIDENCE_CLAIMS,
  EVIDENCE_SOURCES,
  RESEARCH_WEEKLY_SET_BAND,
} from './catalog';
import type { EvidenceClaim, EvidenceSource } from './types';

export type {
  ClaimSourceSupport,
  EvidenceCatalog,
  EvidenceClaim,
  EvidenceKind,
  EvidenceSource,
  EvidenceType,
} from './types';
export {
  EVIDENCE_CATALOG,
  EVIDENCE_CLAIMS,
  EVIDENCE_SOURCES,
  RESEARCH_WEEKLY_SET_BAND,
} from './catalog';

const sourceById = new Map<string, EvidenceSource>(
  EVIDENCE_SOURCES.map((source) => [source.id, source]),
);
const claimById = new Map<string, EvidenceClaim>(
  EVIDENCE_CLAIMS.map((claim) => [claim.id, claim]),
);

export function getClaim(id: string): EvidenceClaim | undefined {
  return claimById.get(id);
}

export function getSource(id: string): EvidenceSource | undefined {
  return sourceById.get(id);
}

export function getSourcesForClaim(claimId: string): EvidenceSource[] {
  const claim = claimById.get(claimId);
  if (!claim) return [];
  return claim.sourceIds
    .map((id) => sourceById.get(id))
    .filter((source): source is EvidenceSource => source !== undefined);
}

export function getClaimsForBehavior(behavior: string): EvidenceClaim[] {
  return EVIDENCE_CLAIMS.filter((claim) => claim.behaviors.includes(behavior));
}

export function listClaimsByKind(kind: EvidenceClaim['kind']): EvidenceClaim[] {
  return EVIDENCE_CLAIMS.filter((claim) => claim.kind === kind);
}

/** Convenience for Data Lab muscle targets. */
export function researchMuscleTargetClaim(): EvidenceClaim {
  const claim = getClaim('weekly-credited-sets-10-20');
  if (!claim) {
    throw new Error('Missing required evidence claim weekly-credited-sets-10-20');
  }
  return claim;
}

export function assertCatalogIntegrity(catalog = EVIDENCE_CATALOG): void {
  const ids = new Set(catalog.sources.map((source) => source.id));
  for (const claim of catalog.claims) {
    for (const sourceId of claim.sourceIds) {
      if (!ids.has(sourceId)) {
        throw new Error(`Claim ${claim.id} references missing source ${sourceId}`);
      }
    }
  }
  const band = RESEARCH_WEEKLY_SET_BAND;
  if (band.min !== 10 || band.max !== 20) {
    throw new Error('Research weekly set band drifted from the stable 10–20 product default');
  }
}
