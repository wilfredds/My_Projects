import { Timestamp } from 'firebase/firestore';

/**
 * The exact key set each Dart `toMap()` emits, mirroring the rules allowlists.
 *
 * These are asserted against the fixtures below (drift guard G1) so a fixture
 * that drifts from the rules fails loudly instead of silently testing the
 * wrong shape. The Dart side has a matching guard.
 *
 * NOTE: `rides` uses `distance`/`elevation`/`avgSpeed` — NOT the Dart property
 * names distanceKm/elevationM/avgSpeedKmh. Likewise `ai_reports` stores
 * `recommendations`, whose entity field is `findings`.
 */
export const ALLOWED = {
  users: ['email', 'profile', 'goals', 'preferences'],
  bikes: ['userId', 'name', 'frame', 'groupset', 'tires', 'totalMileageKm', 'imageUrl', 'components'],
  rides: ['userId', 'bikeId', 'title', 'startedAt', 'distance', 'elevation', 'avgSpeed',
    'durationSec', 'calories', 'cadence', 'heartRate', 'power', 'odometerDeltaKm'],
  maintenance_logs: ['userId', 'bikeId', 'component', 'mileageAtService', 'status', 'serviceDate', 'notes'],
  ai_reports: ['userId', 'bikeId', 'type', 'imageUrl', 'healthScore', 'riskLevel', 'summary',
    'recommendations', 'createdAt'],
};

/**
 * Every factory emits ALL keys, including explicit nulls, exactly as the Dart
 * `toMap()` does. A rider with no avatar, no bike photo and no cadence sensor
 * still writes those keys with a null value — a bare `is string` check in the
 * rules would reject them, so these nulls are the most important part of the
 * fixtures.
 */

export const aUser = (over = {}) => ({
  email: 'alice@example.com',
  profile: {
    displayName: 'Alice',
    level: 'intermediate',
    avatarUrl: null,
    weightKg: null,
  },
  goals: [],
  preferences: { metricUnits: true, darkMode: true, notificationsEnabled: true },
  ...over,
});

export const aBike = (uid = 'alice', over = {}) => ({
  userId: uid,
  name: 'Roadie',
  frame: 'Carbon endurance',
  groupset: 'Shimano 105 R7000',
  tires: 'Continental GP5000 28c',
  totalMileageKm: 4200,
  imageUrl: null,
  components: [],
  ...over,
});

export const aRide = (uid = 'alice', over = {}) => ({
  userId: uid,
  bikeId: null,
  title: 'Morning ride',
  startedAt: Timestamp.fromDate(new Date('2026-11-01T06:00:00Z')),
  distance: 62.4,
  elevation: 540,
  avgSpeed: 27.8,
  durationSec: 8080,
  calories: 1480,
  cadence: null,
  heartRate: null,
  power: null,
  // Null = this ride moved no odometer (no bike, or it predates accounting).
  odometerDeltaKm: null,
  ...over,
});

export const aLog = (uid = 'alice', over = {}) => ({
  userId: uid,
  bikeId: 'bike-1',
  component: 'Chain',
  mileageAtService: 4200,
  status: 'dueSoon',
  serviceDate: Timestamp.fromDate(new Date('2026-10-20T00:00:00Z')),
  notes: '',
  ...over,
});

export const aReport = (uid = 'alice', over = {}) => ({
  userId: uid,
  bikeId: null,
  type: 'bikeHealth',
  imageUrl: null,
  healthScore: 74,
  riskLevel: 'medium',
  summary: 'Chain shows wear.',
  recommendations: [
    { area: 'Chain', issue: 'Worn', severity: 'medium', suggestions: ['Replace chain'] },
  ],
  createdAt: Timestamp.fromDate(new Date('2026-11-01T07:00:00Z')),
  ...over,
});
