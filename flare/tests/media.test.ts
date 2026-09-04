import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { parseVideoUrl } from "../src/lib/media/video.ts";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES,
  checkAttachment,
  checkVideoFile,
  safeFileName,
  storagePathFor,
} from "../src/lib/media/attachments.ts";

/**
 * Media handling.
 *
 * The video parser carries real weight: its output becomes an <iframe src>
 * inside a government training portal, so anything that gets through can
 * frame arbitrary content — a credential prompt styled like FLARE, for
 * instance — under a domain BFP personnel are told to trust.
 */

describe("parseVideoUrl", () => {
  test("accepts the YouTube link shapes people actually paste", () => {
    const forms = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ];

    for (const url of forms) {
      const result = parseVideoUrl(url);
      assert.equal(result.ok, true, url);
      assert.equal(
        result.ok && result.value.embedUrl,
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        url,
      );
    }
  });

  test("embeds YouTube through the nocookie host", () => {
    // FLARE's Privacy Notice enumerates what the platform collects and says
    // nothing about third-party advertising cookies being set on BFP staff.
    const result = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.match(result.ok ? result.value.embedUrl : "", /youtube-nocookie\.com/);
  });

  test("accepts Vimeo links and asks Vimeo not to track", () => {
    for (const url of ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"]) {
      const result = parseVideoUrl(url);
      assert.equal(result.ok, true, url);
      assert.equal(result.ok && result.value.embedUrl, "https://player.vimeo.com/video/123456789?dnt=1");
    }
  });

  test("REFUSES a lookalike hostname", () => {
    // A suffix check would accept every one of these.
    const lookalikes = [
      "https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ",
      "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
      "https://vimeo.com.evil.test/123456789",
      "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
    ];

    for (const url of lookalikes) {
      assert.equal(parseVideoUrl(url).ok, false, url);
    }
  });

  test("REFUSES non-http schemes", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ]) {
      assert.equal(parseVideoUrl(url).ok, false, url);
    }
  });

  test("refuses a known host with no usable video id", () => {
    assert.equal(parseVideoUrl("https://www.youtube.com/").ok, false);
    assert.equal(parseVideoUrl("https://www.youtube.com/watch?v=tooshort").ok, false);
    assert.equal(parseVideoUrl("https://vimeo.com/notanumber").ok, false);
  });

  test("rebuilds the URL rather than passing the input through", () => {
    // Extra query parameters on the author's link must not survive into the
    // frame — that is the difference between rebuilding and sanitising.
    const result = parseVideoUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1&evil=%3Cscript%3E",
    );

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  test("refuses empty and non-string input", () => {
    for (const value of ["", "   ", null, undefined, 42, {}]) {
      assert.equal(parseVideoUrl(value).ok, false, JSON.stringify(value));
    }
  });
});

describe("checkAttachment", () => {
  const pdf = { name: "ERG-2024.pdf", size: 2_000_000, type: "application/pdf" };

  test("accepts an ordinary training document", () => {
    assert.equal(checkAttachment(pdf).ok, true);
  });

  test("refuses types not on the allowlist", () => {
    // A training portal that serves any file type is a convenient way to
    // distribute anything.
    for (const type of [
      "application/x-msdownload",
      "application/x-sh",
      "text/html",
      "image/svg+xml",
      "",
    ]) {
      assert.equal(checkAttachment({ ...pdf, type }).ok, false, type);
    }
  });

  test("enforces the size limit at the boundary", () => {
    assert.equal(checkAttachment({ ...pdf, size: MAX_ATTACHMENT_BYTES }).ok, true);
    assert.equal(checkAttachment({ ...pdf, size: MAX_ATTACHMENT_BYTES + 1 }).ok, false);
  });

  test("refuses an empty file", () => {
    assert.equal(checkAttachment({ ...pdf, size: 0 }).ok, false);
  });
});

describe("checkVideoFile", () => {
  test("accepts MP4 and WebM only", () => {
    assert.equal(checkVideoFile({ name: "a.mp4", size: 1000, type: "video/mp4" }).ok, true);
    assert.equal(checkVideoFile({ name: "a.webm", size: 1000, type: "video/webm" }).ok, true);
    assert.equal(checkVideoFile({ name: "a.mov", size: 1000, type: "video/quicktime" }).ok, false);
  });

  test("allows a far larger file than a document", () => {
    assert.equal(checkVideoFile({ name: "a.mp4", size: MAX_VIDEO_BYTES, type: "video/mp4" }).ok, true);
    assert.equal(checkVideoFile({ name: "a.mp4", size: MAX_VIDEO_BYTES + 1, type: "video/mp4" }).ok, false);
  });
});

describe("safeFileName", () => {
  test("keeps an ordinary name", () => {
    assert.equal(safeFileName("High-Rise Operations Manual.pdf"), "High-Rise Operations Manual.pdf");
  });

  test("strips directory components", () => {
    assert.equal(safeFileName("../../../etc/passwd"), "passwd");
    assert.equal(safeFileName("C:\\Users\\admin\\secret.pdf"), "secret.pdf");
  });

  test("strips control characters that would break a download header", () => {
    assert.equal(safeFileName("report\r\n.pdf"), "report.pdf");
  });

  test("never returns an empty or dot name", () => {
    assert.equal(safeFileName(""), "file");
    assert.equal(safeFileName("."), "file");
    assert.equal(safeFileName(".."), "file");
    assert.equal(safeFileName("/"), "file");
  });
});

describe("storagePathFor", () => {
  test("builds the path from trusted ids only", () => {
    const path = storagePathFor({
      categoryId: "land",
      lessonId: "lesson-1",
      sectionId: "resources",
      fileId: "abc123",
    });

    assert.equal(path, "catalog/land/lesson-1/resources/abc123");
  });

  test("contains no part of the uploaded filename", () => {
    // The author's filename is a label only. It never reaches the path, which
    // is why storage.rules can gate writes by prefix and why a file called
    // "../secret" cannot escape its folder.
    const path = storagePathFor({
      categoryId: "land",
      lessonId: "lesson-1",
      sectionId: "resources",
      fileId: "xyz789",
    });

    assert.ok(!path.includes(".."));
    assert.match(path, /^catalog\/[a-z0-9-]+\/[a-z0-9-]+\/(discussion|resources|assessment)\/[A-Za-z0-9_-]+$/);
  });
});
