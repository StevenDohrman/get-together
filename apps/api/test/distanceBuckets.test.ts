import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bucketDistanceMeters } from '../src/services/distanceBuckets.js';

const METERS_PER_MILE = 1609.344;

describe('bucketDistanceMeters', () => {
  it('returns null for missing or invalid distances', () => {
    assert.equal(bucketDistanceMeters(null), null);
    assert.equal(bucketDistanceMeters(undefined), null);
    assert.equal(bucketDistanceMeters(Number.NaN), null);
    assert.equal(bucketDistanceMeters(-1), null);
  });

  it('classifies exact mile boundaries on the inclusive edge', () => {
    // Boundaries are upper-inclusive, so e.g. 2.0 mi → NEARBY.
    assert.equal(bucketDistanceMeters(0), 'NEARBY');
    assert.equal(bucketDistanceMeters(2 * METERS_PER_MILE), 'NEARBY');
    assert.equal(bucketDistanceMeters(5 * METERS_PER_MILE), 'WITHIN_5MI');
    assert.equal(bucketDistanceMeters(15 * METERS_PER_MILE), 'WITHIN_15MI');
    assert.equal(bucketDistanceMeters(30 * METERS_PER_MILE), 'WITHIN_30MI');
    assert.equal(bucketDistanceMeters(60 * METERS_PER_MILE), 'WITHIN_60MI');
    assert.equal(bucketDistanceMeters(120 * METERS_PER_MILE), 'WITHIN_120MI');
  });

  it('classifies the bucket interiors', () => {
    assert.equal(bucketDistanceMeters(1 * METERS_PER_MILE), 'NEARBY');
    assert.equal(bucketDistanceMeters(3 * METERS_PER_MILE), 'WITHIN_5MI');
    assert.equal(bucketDistanceMeters(10 * METERS_PER_MILE), 'WITHIN_15MI');
    assert.equal(bucketDistanceMeters(20 * METERS_PER_MILE), 'WITHIN_30MI');
    assert.equal(bucketDistanceMeters(45 * METERS_PER_MILE), 'WITHIN_60MI');
    assert.equal(bucketDistanceMeters(90 * METERS_PER_MILE), 'WITHIN_120MI');
  });

  it('returns FAR above the largest bucket', () => {
    assert.equal(bucketDistanceMeters(120.1 * METERS_PER_MILE), 'FAR');
    assert.equal(bucketDistanceMeters(500 * METERS_PER_MILE), 'FAR');
    assert.equal(bucketDistanceMeters(1_000_000_000), 'FAR');
  });

  it('coarsens any sub-mile distance to NEARBY (kills sub-bucket precision leaks)', () => {
    for (const meters of [1, 50, 500, 999, 1500, 1609, 2000, 3000]) {
      assert.equal(bucketDistanceMeters(meters), 'NEARBY');
    }
  });
});
