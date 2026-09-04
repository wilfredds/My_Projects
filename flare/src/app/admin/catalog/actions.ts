"use server";

import { revalidatePath } from "next/cache";
import { withAdmin, type ActionResult } from "@/lib/admin/guard";
import {
  createCategory,
  createLesson,
  saveSection,
  updateCategory,
  updateLesson,
} from "@/lib/catalog/authoring";
import {
  isLessonSection,
  validateCategoryDraft,
  validateLessonDraft,
  validateSectionBody,
} from "@/lib/catalog/validate";

/**
 * Content authoring mutations.
 *
 * Each is a public endpoint once compiled, so each re-checks through
 * withAdmin() rather than relying on the page that renders the form.
 */

export async function addCategory(formData: FormData): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const draft = validateCategoryDraft({
      title: formData.get("title"),
      description: formData.get("description"),
      published: formData.get("published") === "on",
    });
    if (!draft.ok) return { ok: false, error: draft.error };

    const result = await createCategory({ actorUid: admin.uid, draft: draft.value });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/admin/catalog");
    return { ok: true };
  });
}

export async function editCategory(categoryId: string, formData: FormData): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const draft = validateCategoryDraft({
      title: formData.get("title"),
      description: formData.get("description"),
      published: formData.get("published") === "on",
    });
    if (!draft.ok) return { ok: false, error: draft.error };

    const result = await updateCategory({ actorUid: admin.uid, categoryId, draft: draft.value });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${categoryId}`);
    return { ok: true };
  });
}

export async function addLesson(categoryId: string, formData: FormData): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const draft = validateLessonDraft({
      title: formData.get("title"),
      published: formData.get("published") === "on",
    });
    if (!draft.ok) return { ok: false, error: draft.error };

    const result = await createLesson({ actorUid: admin.uid, categoryId, draft: draft.value });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}`);
    return { ok: true };
  });
}

export async function editLesson(
  categoryId: string,
  lessonId: string,
  formData: FormData,
): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const draft = validateLessonDraft({
      title: formData.get("title"),
      published: formData.get("published") === "on",
    });
    if (!draft.ok) return { ok: false, error: draft.error };

    const result = await updateLesson({ actorUid: admin.uid, categoryId, lessonId, draft: draft.value });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}`);
    revalidatePath(`/admin/catalog/${categoryId}/${lessonId}`);
    return { ok: true };
  });
}

export async function saveLessonSection(
  categoryId: string,
  lessonId: string,
  sectionId: string,
  formData: FormData,
): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    if (!isLessonSection(sectionId)) return { ok: false, error: "Unknown section." };

    const body = validateSectionBody(formData.get("body"));
    if (!body.ok) return { ok: false, error: body.error };

    const result = await saveSection({
      actorUid: admin.uid,
      categoryId,
      lessonId,
      sectionId,
      body: body.value,
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}/${lessonId}`);
    return { ok: true };
  });
}
