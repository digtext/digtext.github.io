import React, { useCallback, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DigCloseIcon,
  DigEllipsisIcon,
  digCloseButtonClass,
  digIconButtonClass,
} from "@/components/DigIcons";
import { cn } from "@/lib/utils";

const TOKEN_PREFIX = "\uE000DIG";
const TOKEN_SUFFIX = "\uE001";
const TOKEN_RE = /\uE000DIG(\d+)\uE001/g;

export interface InlineDigExpandable {
  id: number;
  shadow: string;
}

export interface InlineDigExtractResult {
  shadow: string;
  map: Map<number, InlineDigExpandable>;
}

export type InlineDigRenderMode = "inline" | "indented";

export function extractParenthesisExpandables(raw: string): InlineDigExtractResult {
  const map = new Map<number, InlineDigExpandable>();
  let nextId = 0;

  const process = (text: string): string => {
    let out = "";
    let i = 0;
    let markdownLinkDepth = 0;

    while (i < text.length) {
      if (markdownLinkDepth === 0 && text[i] === "]" && text[i + 1] === "(") {
        out += "](";
        markdownLinkDepth = 1;
        i += 2;
        continue;
      }

      if (markdownLinkDepth > 0) {
        out += text[i];

        if (text[i] === "(") markdownLinkDepth += 1;
        else if (text[i] === ")") markdownLinkDepth -= 1;

        i += 1;
        continue;
      }

      if (text[i] === "(" && text[i + 1] === "(") {
        let nest = 1;
        let j = i + 2;
        let matched = false;
        let nestedMarkdownLinkDepth = 0;

        while (j < text.length) {
          if (
            nestedMarkdownLinkDepth === 0 &&
            text[j] === "]" &&
            text[j + 1] === "("
          ) {
            nestedMarkdownLinkDepth = 1;
            j += 2;
            continue;
          }

          if (nestedMarkdownLinkDepth > 0) {
            if (text[j] === "(") nestedMarkdownLinkDepth += 1;
            else if (text[j] === ")") nestedMarkdownLinkDepth -= 1;

            j += 1;
            continue;
          }

          if (text[j] === "(" && text[j + 1] === "(") {
            nest += 1;
            j += 2;
            continue;
          }

          if (text[j] === ")" && text[j + 1] === ")") {
            nest -= 1;
            if (nest === 0) {
              matched = true;
              break;
            }
            j += 2;
            continue;
          }

          j += 1;
        }

        if (!matched) {
          out += "((";
          i += 2;
          continue;
        }

        const inner = text.slice(i + 2, j);
        const innerShadow = process(inner);
        const id = nextId++;
        map.set(id, { id, shadow: innerShadow });
        out += `${TOKEN_PREFIX}${id}${TOKEN_SUFFIX}`;
        i = j + 2;
        continue;
      }

      if (text[i] === ")" && text[i + 1] === ")") {
        i += 2;
        continue;
      }

      out += text[i];
      i += 1;
    }

    return out;
  };

  return {
    shadow: process(raw),
    map,
  };
}

interface ExpandButtonProps {
  isExpanded: boolean;
  onClick: () => void;
}

const ExpandButton = ({ isExpanded, onClick }: ExpandButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      isExpanded ? digCloseButtonClass : digIconButtonClass,
      "relative -top-[0.18em] mx-px cursor-pointer",
    )}
    aria-label={isExpanded ? "Collapse" : "Expand"}
    type="button"
  >
    {isExpanded ? <DigCloseIcon /> : <DigEllipsisIcon />}
  </button>
);

interface InlineExpandSegmentProps {
  id: number;
  inner: string;
  expandedIds: Set<number>;
  toggle: (id: number) => void;
  expandablesMap: Map<number, InlineDigExpandable>;
  renderMode: InlineDigRenderMode;
  linkClassName?: string;
}

const InlineExpandSegment = ({
  id,
  inner,
  expandedIds,
  toggle,
  expandablesMap,
  renderMode,
  linkClassName,
}: InlineExpandSegmentProps) => {
  const isExpanded = expandedIds.has(id);

  if (renderMode === "indented") {
    return (
      <span className="align-baseline">
        <ExpandButton isExpanded={isExpanded} onClick={() => toggle(id)} />
        {isExpanded && (
          <span className="mt-3 ml-6 block border-l border-[#CEC9F2] pl-4 dark:border-[#7E76C9]">
            <InlineDigMarkdown
              shadow={inner}
              expandablesMap={expandablesMap}
              expandedIds={expandedIds}
              toggle={toggle}
              inline
              renderMode={renderMode}
              linkClassName={linkClassName}
            />
          </span>
        )}
      </span>
    );
  }

  return (
    <span>
      <ExpandButton isExpanded={isExpanded} onClick={() => toggle(id)} />
      {isExpanded && (
        <span className="underline decoration-[#CEC9F2] decoration-[1px] underline-offset-[2px] transition-colors dark:decoration-[#8E86D8]">
          <InlineDigMarkdown
            shadow={inner}
            expandablesMap={expandablesMap}
            expandedIds={expandedIds}
            toggle={toggle}
            inline
            renderMode={renderMode}
            linkClassName={linkClassName}
          />
        </span>
      )}
    </span>
  );
};

interface InlineDigMarkdownProps {
  shadow: string;
  expandablesMap: Map<number, InlineDigExpandable>;
  expandedIds: Set<number>;
  toggle: (id: number) => void;
  inline?: boolean;
  unwrapParagraphs?: boolean;
  renderMode?: InlineDigRenderMode;
  linkClassName?: string;
}

export const InlineDigMarkdown = ({
  shadow,
  expandablesMap,
  expandedIds,
  toggle,
  inline = false,
  unwrapParagraphs = false,
  renderMode = "inline",
  linkClassName,
}: InlineDigMarkdownProps) => {
  const replaceTokens = useCallback(
    (children: React.ReactNode): React.ReactNode =>
      React.Children.map(children, (child, idx) => {
        if (typeof child !== "string") return child;

        const parts: React.ReactNode[] = [];
        let last = 0;
        TOKEN_RE.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = TOKEN_RE.exec(child)) !== null) {
          if (match.index > last) parts.push(child.slice(last, match.index));

          const id = Number(match[1]);
          const expandable = expandablesMap.get(id);

          if (expandable) {
            parts.push(
              <InlineExpandSegment
                key={`dig-${id}-${idx}`}
                id={id}
                inner={expandable.shadow}
                expandedIds={expandedIds}
                toggle={toggle}
                expandablesMap={expandablesMap}
                renderMode={renderMode}
                linkClassName={linkClassName}
              />,
            );
          }

          last = TOKEN_RE.lastIndex;
        }

        if (last < child.length) parts.push(child.slice(last));

        return parts.length > 0 ? parts : child;
      }),
    [expandablesMap, expandedIds, linkClassName, renderMode, toggle],
  );

  const components: Components = useMemo(() => {
    const inlineParagraph: Components["p"] = ({ node: _node, children }) => (
      <span
        className={cn(
          renderMode === "indented" && "my-3 block first:mt-0 last:mb-0",
        )}
      >
        {replaceTokens(children)}
      </span>
    );

    const inlineHeading: Components["h1"] = ({ node: _node, children }) => (
      <span
        className={cn(
          "font-semibold",
          renderMode === "indented" && "mt-4 mb-2 block first:mt-0",
        )}
      >
        {replaceTokens(children)}
      </span>
    );

    return {
      p: inline
        ? inlineParagraph
        : unwrapParagraphs
          ? ({ node: _node, children }) => <>{replaceTokens(children)}</>
          : ({ node: _node, children, ...props }) => (
              <p {...props}>{replaceTokens(children)}</p>
            ),
      h1: inline
        ? inlineHeading
        : ({ node: _node, children, ...props }) => (
            <h1 {...props}>{replaceTokens(children)}</h1>
          ),
      h2: inline
        ? inlineHeading
        : ({ node: _node, children, ...props }) => (
            <h2 {...props}>{replaceTokens(children)}</h2>
          ),
      h3: inline
        ? inlineHeading
        : ({ node: _node, children, ...props }) => (
            <h3 {...props}>{replaceTokens(children)}</h3>
          ),
      h4: inline
        ? inlineHeading
        : ({ node: _node, children, ...props }) => (
            <h4 {...props}>{replaceTokens(children)}</h4>
          ),
      h5: inline
        ? inlineHeading
        : ({ node: _node, children, ...props }) => (
            <h5 {...props}>{replaceTokens(children)}</h5>
          ),
      h6: inline
        ? inlineHeading
        : ({ node: _node, children, ...props }) => (
            <h6 {...props}>{replaceTokens(children)}</h6>
          ),
      blockquote: inline
        ? ({ node: _node, children }) => (
            <span
              className={cn(
                renderMode === "indented" &&
                  "my-3 block border-l-4 border-neutral-200 pl-4 italic text-neutral-500 dark:border-neutral-800 dark:text-neutral-400",
              )}
            >
              {replaceTokens(children)}
            </span>
          )
        : ({ node: _node, children, ...props }) => (
            <blockquote {...props}>{replaceTokens(children)}</blockquote>
          ),
      li: ({ node: _node, children, ...props }) => (
        <li {...props}>{replaceTokens(children)}</li>
      ),
      em: ({ node: _node, children, ...props }) => (
        <em {...props}>{replaceTokens(children)}</em>
      ),
      strong: ({ node: _node, children, ...props }) => (
        <strong {...props}>{replaceTokens(children)}</strong>
      ),
      a: ({ node: _node, children, className, ...props }) => (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(linkClassName, className)}
        >
          {replaceTokens(children)}
        </a>
      ),
      code: ({ node: _node, children, ...props }) => (
        <code {...props}>{replaceTokens(children)}</code>
      ),
      td: ({ node: _node, children, ...props }) => (
        <td {...props}>{replaceTokens(children)}</td>
      ),
      th: ({ node: _node, children, ...props }) => (
        <th {...props}>{replaceTokens(children)}</th>
      ),
    };
  }, [inline, linkClassName, renderMode, replaceTokens, unwrapParagraphs]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {shadow}
    </ReactMarkdown>
  );
};
