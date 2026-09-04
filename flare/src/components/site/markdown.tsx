import ReactMarkdown from "react-markdown";

/**
 * Renders authored lesson content.
 *
 * react-markdown produces React elements, never an HTML string — so nothing
 * here goes near dangerouslySetInnerHTML, and raw HTML typed into a section
 * is displayed as the text it is rather than executed. That is the other half
 * of the decision made in `validateSectionBody`: content is stored as inert
 * Markdown, and this is the one controlled place it becomes markup.
 *
 * There is deliberately no preview of this in the authoring UI. A preview
 * built on a different renderer than production is a preview that lies, so
 * the admin editor shows the Markdown source and this is what learners see.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h3 className="text-lg font-bold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-bold">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-bold">{children}</h4>,
          p: ({ children }) => <p className="max-w-[70ch]">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              // Authored links point off-site; noreferrer keeps the target
              // from learning which FLARE page a firefighter came from.
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
