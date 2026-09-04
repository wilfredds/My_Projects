import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Announcement } from "@/lib/types";
import type { AnnouncementDraft } from "./validate.ts";

/**
 * Announcements — the broadcast half of the design's Feed screen.
 *
 * One document per announcement, read by everyone activated. Per-user read
 * state ("Mark as Read") lives separately under users/{uid}/notifications,
 * so publishing does not write once per user: fanning out to every BFP
 * account on each announcement would be a write storm for no gain.
 */

export async function publishAnnouncement(
  draft: AnnouncementDraft,
  authorUid: string,
): Promise<string> {
  const ref = await getAdminDb()
    .collection("announcements")
    .add({
      ...draft,
      createdBy: authorUid,
      createdAt: new Date().toISOString(),
    });

  return ref.id;
}

export async function listRecentAnnouncements(limit = 20): Promise<Announcement[]> {
  const snapshot = await getAdminDb()
    .collection("announcements")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Announcement);
}
