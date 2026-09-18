import { describe, expect, it } from 'vitest';
import { answerAskLab } from './askLab';

describe('answerAskLab', () => {
  it('maps the 10–20 band question to the research default claim', () => {
    const answer = answerAskLab('Why is the research default 10–20 credited sets?');
    expect(answer.refused).toBe(false);
    expect(answer.matches[0]?.claim.id).toBe('weekly-credited-sets-10-20');
    expect(answer.matches[0]?.claim.kind).toBe('evidence_backed_default');
  });

  it('labels secondary credit as a heuristic', () => {
    const answer = answerAskLab('Why do secondary muscles get 0.5 credit?');
    expect(answer.refused).toBe(false);
    expect(answer.matches[0]?.claim.id).toBe('secondary-set-credit-default');
    expect(answer.matches[0]?.claim.kind).toBe('implementation_heuristic');
  });

  it('refuses unknown questions without inventing sources', () => {
    const answer = answerAskLab('Should I take creatine on rest days?');
    expect(answer.refused).toBe(true);
    expect(answer.matches).toHaveLength(0);
    expect(answer.call.toLowerCase()).toContain('not in the evidence layer');
  });

  it('resolves e1RM formula questions to pure calculation', () => {
    const answer = answerAskLab('How is estimated 1RM calculated with Epley?');
    expect(answer.refused).toBe(false);
    expect(answer.matches.some((row) => row.claim.id === 'e1rm-formulas')).toBe(true);
  });
});
