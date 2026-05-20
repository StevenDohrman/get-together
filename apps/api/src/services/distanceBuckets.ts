/**
 * Privacy-preserving distance buckets shown on Discover cards.
 *
 * The API never returns precise distance values: it returns one of these
 * coarse buckets so that an attacker hitting `/matching/discovery` from
 * several known-location accounts can't trilaterate a target to better
 * than the bucket boundary they fall into.
 *
 * Combined with the lat/lng grid snapping applied at write time in
 * `PATCH /profile`, the precise location of a user is never on the wire
 * or computable by a peer.
 */
export type DistanceBucket =
  | 'NEARBY'
  | 'WITHIN_5MI'
  | 'WITHIN_15MI'
  | 'WITHIN_30MI'
  | 'WITHIN_60MI'
  | 'WITHIN_120MI'
  | 'FAR';

const METERS_PER_MILE = 1609.344;

/** Upper-inclusive bucket boundaries (in meters), evaluated in order. */
const BUCKET_THRESHOLDS: readonly { bucket: DistanceBucket; maxMeters: number }[] = [
  { bucket: 'NEARBY', maxMeters: 2 * METERS_PER_MILE },
  { bucket: 'WITHIN_5MI', maxMeters: 5 * METERS_PER_MILE },
  { bucket: 'WITHIN_15MI', maxMeters: 15 * METERS_PER_MILE },
  { bucket: 'WITHIN_30MI', maxMeters: 30 * METERS_PER_MILE },
  { bucket: 'WITHIN_60MI', maxMeters: 60 * METERS_PER_MILE },
  { bucket: 'WITHIN_120MI', maxMeters: 120 * METERS_PER_MILE },
];

/**
 * Returns the {@link DistanceBucket} for `meters`, or `null` if the distance
 * is unknown (e.g. either user has no saved location).
 */
export function bucketDistanceMeters(meters: number | null | undefined): DistanceBucket | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  for (const { bucket, maxMeters } of BUCKET_THRESHOLDS) {
    if (meters <= maxMeters) return bucket;
  }
  return 'FAR';
}
