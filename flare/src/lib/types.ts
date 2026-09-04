// Domain types for FLARE, mirroring the collections documented in
// docs/DATA-MODEL.md. Kept free of Firebase imports so they can be used from
// both server and client code, and from tests that touch no database.

/** The three sections every lesson has, in the order the design shows them. */
export const LESSON_SECTIONS = ["discussion", "resources", "assessment"] as const;
export type LessonSection = (typeof LESSON_SECTIONS)[number];

/** The two states the design's per-section toggle can be in. */
export type SectionState = "not_started" | "finished";

/** What a Home card renders: ACCESS, a progress bar, or the certificate row. */
export type CategoryStatus = "not_started" | "in_progress" | "completed";

export type UserRole = "learner" | "admin";

/**
 * A Firebase account is not authorization. FLARE is restricted to BFP
 * personnel, so an account waits at "pending" until an administrator
 * activates it. Suspension revokes access without deleting the account,
 * because the training records attached to it are compliance evidence.
 */
export type UserStatus = "pending" | "active" | "suspended";

export type UserPreferences = {
  theme: ThemePreference;
  language: string;
  notificationsPaused: boolean;
};

export type UserProfile = {
  uid: string;
  username: string;
  email: string;
  fullName: string;
  /** Official BFP identity. Administrator-managed — see firestore.rules. */
  rank: string;
  badgeNumber: string;
  unit: string;
  position: string;
  contactNumber: string;
  role: UserRole;
  status: UserStatus;
  preferences: UserPreferences;
  createdAt: string;
  lastLoginAt: string | null;
};

export type ThemePreference = "system" | "light" | "dark";

export type Category = {
  id: string;
  title: string;
  order: number;
  description: string;
  /** Drives the per-category palette the design gives each training track. */
  theme: string;
  iconPath: string | null;
  heroImagePath: string | null;
  published: boolean;
};

export type Lesson = {
  id: string;
  title: string;
  order: number;
  heroImagePath: string | null;
  published: boolean;
};

export type Attachment = {
  /** Stable id, also the last path segment in Storage. */
  id: string;
  /** The name the author uploaded, shown to learners on the download link. */
  name: string;
  storagePath: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
};

/**
 * A lesson's video, which may be hosted or embedded.
 *
 * Both are supported rather than one being chosen, because the choice is a
 * cost and policy decision for the client — Firebase Storage egress is billed
 * and BFP-wide video traffic is not trivial, while an embed hands viewing
 * data to a third party. Supporting both means that decision can be made per
 * video, and changed later, without a schema migration.
 */
export type LessonVideo =
  | { kind: "upload"; storagePath: string; name: string; sizeBytes: number }
  | { kind: "embed"; provider: "youtube" | "vimeo"; embedUrl: string; sourceUrl: string };

export type LessonSectionContent = {
  id: LessonSection;
  body: string;
  attachments: Attachment[];
  video: LessonVideo | null;
  updatedAt: string | null;
};

export type QuestionOption = {
  id: string;
  label: string;
};

/**
 * A question as the learner is allowed to see it. There is deliberately no
 * field for the correct answer: those live in the server-only `answerKeys`
 * collection, because Firestore rules gate documents rather than fields.
 */
export type Question = {
  id: string;
  order: number;
  prompt: string;
  type: "single" | "multiple";
  options: QuestionOption[];
};

export type LessonProgress = Partial<Record<LessonSection, SectionState>>;

export type CategoryProgress = {
  lessons: Record<string, LessonProgress>;
  updatedAt: string | null;
};

export type CategorySummary = {
  totalSections: number;
  finishedSections: number;
  /** 0–100, for the design's progress bar. Derived, never stored. */
  percent: number;
  status: CategoryStatus;
};

/**
 * The four kinds of item the design's Feed screen shows, taken from the
 * labels in the frames themselves rather than invented.
 */
export const ANNOUNCEMENT_TYPES = [
  "course_update",
  "resource",
  "system",
  "assessment_reminder",
] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export type Announcement = {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  createdAt: string;
  createdBy: string;
};

export type AuditEntryRecord = {
  id: string;
  uid: string;
  action: AuditAction;
  targetPath: string | null;
  detail: Record<string, string | number | boolean | null> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string | null;
};

export type AuditAction =
  | "sign_in"
  | "sign_out"
  | "section_completed"
  | "assessment_submitted"
  | "certificate_issued"
  | "profile_updated"
  | "announcement_published"
  | "content_created"
  | "content_updated";
