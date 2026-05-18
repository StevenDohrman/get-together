export type WeightedInterest = {
  interestId: string;
  weight: number;
};

export type NormalizedWeightedScore = {
  sharedInterestCount: number;
  rawMatchScore: number;
  matchScore: number;
};

export const DEFAULT_INTEREST_WEIGHT = 5;

export function normalizedWeightedOverlap(
  left: WeightedInterest[],
  right: WeightedInterest[],
): NormalizedWeightedScore {
  const leftByInterest = new Map(left.map(row => [row.interestId, row.weight]));
  const rightByInterest = new Map(right.map(row => [row.interestId, row.weight]));

  let sharedInterestCount = 0;
  let rawMatchScore = 0;
  for (const [interestId, leftWeight] of leftByInterest.entries()) {
    const rightWeight = rightByInterest.get(interestId);
    if (rightWeight === undefined) continue;
    sharedInterestCount += 1;
    rawMatchScore += leftWeight * rightWeight;
  }

  const leftMagnitude = Math.sqrt(left.reduce((sum, row) => sum + row.weight ** 2, 0));
  const rightMagnitude = Math.sqrt(right.reduce((sum, row) => sum + row.weight ** 2, 0));
  const matchScore =
    leftMagnitude > 0 && rightMagnitude > 0 ? rawMatchScore / (leftMagnitude * rightMagnitude) : 0;

  return {
    sharedInterestCount,
    rawMatchScore,
    matchScore,
  };
}

export function weightedVectorForInterestIds(
  interestIds: string[],
  weightsByInterestId: Map<string, number>,
): WeightedInterest[] {
  return [...new Set(interestIds)].map(interestId => ({
    interestId,
    weight: weightsByInterestId.get(interestId) ?? DEFAULT_INTEREST_WEIGHT,
  }));
}
