import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Category, Lesson, LessonSectionContent, Question } from "@/lib/types";

/**
 * Catalogue reads.
 *
 * Training content is authored by administrators and read by everyone
 * activated. These run through the Admin SDK on the server so pages can be
 * rendered without the browser holding a Firestore connection, and so an
 * unpublished draft never leaves the server.
 */

export async function listCategories(includeUnpublished = false): Promise<Category[]> {
  const snapshot = await getAdminDb().collection("categories").orderBy("order").get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Category)
    .filter((category) => includeUnpublished || category.published);
}

export async function getCategory(categoryId: string): Promise<Category | null> {
  const snapshot = await getAdminDb().collection("categories").doc(categoryId).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() } as Category;
}

export async function listLessons(
  categoryId: string,
  includeUnpublished = false,
): Promise<Lesson[]> {
  const snapshot = await getAdminDb()
    .collection("categories")
    .doc(categoryId)
    .collection("lessons")
    .orderBy("order")
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Lesson)
    .filter((lesson) => includeUnpublished || lesson.published);
}

/**
 * The lesson IDs the rollup counts against.
 *
 * Unpublished lessons are excluded on purpose: a draft should not drag down
 * everyone's completion percentage before anyone can open it.
 */
export async function listPublishedLessonIds(categoryId: string): Promise<string[]> {
  const lessons = await listLessons(categoryId);
  return lessons.map((lesson) => lesson.id);
}

export async function getLessonSections(
  categoryId: string,
  lessonId: string,
): Promise<LessonSectionContent[]> {
  const snapshot = await getAdminDb()
    .collection("categories")
    .doc(categoryId)
    .collection("lessons")
    .doc(lessonId)
    .collection("sections")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LessonSectionContent);
}

/**
 * Questions as the learner may see them.
 *
 * The correct answers are not omitted here — they were never in this
 * collection to begin with. They live in the server-only `answerKeys`
 * collection, so there is no risk of a future change accidentally passing
 * them to the client along with everything else on the document.
 */
export async function listQuestions(
  categoryId: string,
  lessonId: string,
): Promise<Question[]> {
  const snapshot = await getAdminDb()
    .collection("categories")
    .doc(categoryId)
    .collection("lessons")
    .doc(lessonId)
    .collection("questions")
    .orderBy("order")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Question);
}
