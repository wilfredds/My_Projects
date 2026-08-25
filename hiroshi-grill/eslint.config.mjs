import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      /**
       * §6, "escape all output". React escapes everything it renders, which is
       * why stored XSS is not a worry here — a guest whose name is
       * `<script>alert(1)</script>` shows up as those literal characters on the
       * dashboard.
       *
       * `dangerouslySetInnerHTML` is the one way to opt out of that, and this
       * makes opting out a build failure rather than a code-review question.
       * There is exactly one use in the project — the JSON-LD block in
       * layout.tsx, whose content we build ourselves — and it carries an
       * explicit disable comment saying so.
       */
      "react/no-danger": "error",

      /**
       * `target="_blank"` without `rel="noopener"` hands the page it opens a
       * handle on ours via `window.opener`, which it can use to navigate us
       * somewhere else. Cheap to get right, easy to forget.
       */
      "react/jsx-no-target-blank": ["error", { enforceDynamicLinks: "always" }],
    },
  },
]);

export default eslintConfig;
