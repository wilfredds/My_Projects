"use server";

import { revalidatePath } from "next/cache";
import { withAdmin, type ActionResult } from "@/lib/admin/guard";
import { validateAnnouncement } from "@/lib/announcements/validate";
import { publishAnnouncement } from "@/lib/announcements/store";
import { recordAudit } from "@/lib/audit/log";

/** Publishes an announcement to every activated user's feed. */
export async function createAnnouncement(formData: FormData): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const validated = validateAnnouncement({
      type: formData.get("type"),
      title: formData.get("title"),
      body: formData.get("body"),
    });
    if (!validated.ok) return { ok: false, error: validated.error };

    const id = await publishAnnouncement(validated.value, admin.uid);

    await recordAudit({
      uid: admin.uid,
      action: "profile_updated",
      targetPath: `announcements/${id}`,
      detail: { change: "announcement_published", type: validated.value.type },
    });

    revalidatePath("/admin/announcements");
    return { ok: true };
  });
}
