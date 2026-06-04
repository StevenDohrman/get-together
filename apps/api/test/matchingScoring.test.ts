import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_INTEREST_WEIGHT,
  normalizedWeightedOverlap,
  weightedVectorForInterestIds,
} from '../src/services/matchingScoring.js';

describe('matchingScoring', () => {
  it('returns zero scores when either side has no weighted interests', () => {
    assert.deepEqual(normalizedWeightedOverlap([], [{ interestId: 'music', weight: 4 }]), {
      sharedInterestCount: 0,
      rawMatchScore: 0,
      matchScore: 0,
    });

    assert.deepEqual(normalizedWeightedOverlap([{ interestId: 'music', weight: 4 }], []), {
      sharedInterestCount: 0,
      rawMatchScore: 0,
      matchScore: 0,
    });
  });

  it('counts only shared interests in the raw match score', () => {
    const score = normalizedWeightedOverlap(
      [
        { interestId: 'music', weight: 5 },
        { interestId: 'sports', weight: 2 },
        { interestId: 'art', weight: 1 },
      ],
      [
        { interestId: 'music', weight: 3 },
        { interestId: 'sports', weight: 4 },
        { interestId: 'gaming', weight: 5 },
      ],
    );

    assert.equal(score.sharedInterestCount, 2);
    assert.equal(score.rawMatchScore, 23);
    assert.ok(score.matchScore > 0);
    assert.ok(score.matchScore < 1);
  });

  it('normalizes identical weighted interest vectors to a perfect match', () => {
    const interests = [
      { interestId: 'music', weight: 5 },
      { interestId: 'sports', weight: 3 },
      { interestId: 'gaming', weight: 1 },
    ];

    assert.equal(normalizedWeightedOverlap(interests, interests).matchScore, 1);
  });

  it('uses the latest weight when duplicate interest rows appear', () => {
    const score = normalizedWeightedOverlap(
      [
        { interestId: 'music', weight: 1 },
        { interestId: 'music', weight: 5 },
      ],
      [{ interestId: 'music', weight: 4 }],
    );

    assert.equal(score.sharedInterestCount, 1);
    assert.equal(score.rawMatchScore, 20);
  });

  it('deduplicates interest ids and applies default weights when building weighted vectors', () => {
    const weights = new Map([
      ['music', 9],
      ['sports', 2],
    ]);

    assert.deepEqual(weightedVectorForInterestIds(['music', 'music', 'art', 'sports'], weights), [
      { interestId: 'music', weight: 9 },
      { interestId: 'art', weight: DEFAULT_INTEREST_WEIGHT },
      { interestId: 'sports', weight: 2 },
    ]);
  });
});
