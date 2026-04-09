import React, { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * DigText markup format:
 * - Standard markdown (headings, bold, lists, links, code, etc.)
 * - Use <<text>> to mark expandable sections (nesting supported).
 *   The markers act like parentheses: << opens, >> closes.
 *
 * Implementation: extract every <<...>> block into a placeholder map,
 * leaving a "shadow" markdown string with private-use-area tokens. The
 * shadow is rendered with react-markdown; custom component overrides
 * scan their own string children for tokens and replace each with an
 * <ExpandSegment> button. When expanded, the segment recursively renders
 * its inner shadow (so markdown + nested expanders work inside).
 */

const TOKEN_PREFIX = "\uE000EXP";
const TOKEN_SUFFIX = "\uE001";
const TOKEN_RE = /\uE000EXP(\d+)\uE001/g;

export interface Expandable {
  id: number;
  shadow: string;
}

export interface DigTextState {
  shadow: string;
  expandablesMap: Map<number, Expandable>;
  expandedIds: Set<number>;
  hasExpandables: boolean;
  anyExpanded: boolean;
  toggle: (id: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

interface ExtractResult {
  shadow: string;
  map: Map<number, Expandable>;
}

function extractExpandables(raw: string): ExtractResult {
  const map = new Map<number, Expandable>();
  let nextId = 0;

  const process = (text: string): string => {
    let out = "";
    let i = 0;
    while (i < text.length) {
      if (text[i] === "<" && text[i + 1] === "<") {
        // find matching >> at this nest level
        let nest = 1;
        let j = i + 2;
        let matched = false;
        while (j < text.length) {
          if (text[j] === "<" && text[j + 1] === "<") {
            nest++;
            j += 2;
          } else if (text[j] === ">" && text[j + 1] === ">") {
            nest--;
            if (nest === 0) {
              matched = true;
              break;
            }
            j += 2;
          } else {
            j++;
          }
        }
        if (!matched) {
          // unmatched << — treat literally so stray markers don't spawn
          // spurious expand buttons
          out += "<<";
          i += 2;
          continue;
        }
        const inner = text.slice(i + 2, j);
        const innerShadow = process(inner);
        const id = nextId++;
        map.set(id, { id, shadow: innerShadow });
        out += `${TOKEN_PREFIX}${id}${TOKEN_SUFFIX}`;
        i = j + 2; // skip closing >>
      } else if (text[i] === ">" && text[i + 1] === ">") {
        // stray closing — skip silently
        i += 2;
      } else {
        out += text[i];
        i++;
      }
    }
    return out;
  };

  const shadow = process(raw);
  return { shadow, map };
}

interface ExpandButtonProps {
  isExpanded: boolean;
  onClick: () => void;
}

const ExpandButton: React.FC<ExpandButtonProps> = ({ isExpanded, onClick }) => (
  <button
    onClick={onClick}
    className={`relative -top-px inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors mx-0.5 align-middle cursor-pointer ${
      isExpanded
        ? "border-[hsl(var(--expand-button-hover))] bg-[hsl(var(--expand-button-hover))] text-white"
        : "border-expand-button text-expand-button hover:bg-[hsl(var(--expand-button)/0.08)] hover:text-expand-button-hover hover:border-expand-button-hover"
    }`}
    aria-label={isExpanded ? "Collapse" : "Expand"}
    type="button"
  >
    {isExpanded ? <X size={12} strokeWidth={2.5} className="block" /> : <Plus size={12} strokeWidth={2.5} className="block" />}
  </button>
);

interface ExpandSegmentProps {
  id: number;
  inner: string;
  expandedIds: Set<number>;
  toggle: (id: number) => void;
  expandablesMap: Map<number, Expandable>;
}

const ExpandSegment: React.FC<ExpandSegmentProps> = ({
  id,
  inner,
  expandedIds,
  toggle,
  expandablesMap,
}) => {
  const isExpanded = expandedIds.has(id);
  return (
    <span>
      <ExpandButton isExpanded={isExpanded} onClick={() => toggle(id)} />
      {isExpanded && (
        <span className="bg-expanded-bg rounded px-1 py-0.5 transition-all">
          <ShadowMarkdown
            shadow={inner}
            expandedIds={expandedIds}
            toggle={toggle}
            expandablesMap={expandablesMap}
            inline
          />
        </span>
      )}
    </span>
  );
};

interface ShadowMarkdownProps {
  shadow: string;
  expandedIds: Set<number>;
  toggle: (id: number) => void;
  expandablesMap: Map<number, Expandable>;
  /** When true, render in an inline context: paragraphs collapse to spans
   *  so the content can sit inside a parent <p> without breaking flow. */
  inline?: boolean;
}

const ShadowMarkdown: React.FC<ShadowMarkdownProps> = ({
  shadow,
  expandedIds,
  toggle,
  expandablesMap,
  inline = false,
}) => {
  const replaceTokens = useCallback(
    (children: React.ReactNode): React.ReactNode => {
      return React.Children.map(children, (child, idx) => {
        if (typeof child !== "string") return child;
        const parts: React.ReactNode[] = [];
        let last = 0;
        TOKEN_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = TOKEN_RE.exec(child)) !== null) {
          if (match.index > last) parts.push(child.slice(last, match.index));
          const id = Number(match[1]);
          const exp = expandablesMap.get(id);
          if (exp) {
            parts.push(
              <ExpandSegment
                key={`exp-${id}-${idx}`}
                id={id}
                inner={exp.shadow}
                expandedIds={expandedIds}
                toggle={toggle}
                expandablesMap={expandablesMap}
              />,
            );
          }
          last = TOKEN_RE.lastIndex;
        }
        if (last < child.length) parts.push(child.slice(last));
        return parts.length > 0 ? parts : child;
      });
    },
    [expandedIds, toggle, expandablesMap],
  );

  const components: Components = useMemo(() => {
    // In inline mode, block elements collapse to spans so the content can
    // live inside a parent <p> without producing invalid (or visually broken)
    // HTML. Multiple paragraphs in an inline context are joined with a space.
    const inlineP: Components["p"] = ({ node: _n, children }) => (
      <span>{replaceTokens(children)}</span>
    );
    const inlineH: Components["h1"] = ({ node: _n, children }) => (
      <span className="font-semibold">{replaceTokens(children)}</span>
    );

    return {
      p: inline
        ? inlineP
        : ({ node: _n, children, ...props }) => <p {...props}>{replaceTokens(children)}</p>,
      h1: inline
        ? inlineH
        : ({ node: _n, children, ...props }) => <h1 {...props}>{replaceTokens(children)}</h1>,
      h2: inline
        ? inlineH
        : ({ node: _n, children, ...props }) => <h2 {...props}>{replaceTokens(children)}</h2>,
      h3: inline
        ? inlineH
        : ({ node: _n, children, ...props }) => <h3 {...props}>{replaceTokens(children)}</h3>,
      h4: inline
        ? inlineH
        : ({ node: _n, children, ...props }) => <h4 {...props}>{replaceTokens(children)}</h4>,
      h5: inline
        ? inlineH
        : ({ node: _n, children, ...props }) => <h5 {...props}>{replaceTokens(children)}</h5>,
      h6: inline
        ? inlineH
        : ({ node: _n, children, ...props }) => <h6 {...props}>{replaceTokens(children)}</h6>,
      blockquote: inline
        ? ({ node: _n, children }) => <span>{replaceTokens(children)}</span>
        : ({ node: _n, children, ...props }) => (
            <blockquote {...props}>{replaceTokens(children)}</blockquote>
          ),
      li: ({ node: _n, children, ...props }) => <li {...props}>{replaceTokens(children)}</li>,
      em: ({ node: _n, children, ...props }) => <em {...props}>{replaceTokens(children)}</em>,
      strong: ({ node: _n, children, ...props }) => (
        <strong {...props}>{replaceTokens(children)}</strong>
      ),
      a: ({ node: _n, children, ...props }) => <a {...props}>{replaceTokens(children)}</a>,
      code: ({ node: _n, children, ...props }) => (
        <code {...props}>{replaceTokens(children)}</code>
      ),
      td: ({ node: _n, children, ...props }) => <td {...props}>{replaceTokens(children)}</td>,
      th: ({ node: _n, children, ...props }) => <th {...props}>{replaceTokens(children)}</th>,
    };
  }, [replaceTokens, inline]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {shadow}
    </ReactMarkdown>
  );
};

interface DigTextProps {
  content: string;
  className?: string;
  contentClassName?: string;
  showExpandAllButton?: boolean;
}

export const useDigTextState = (content: string): DigTextState => {
  const { shadow, map } = useMemo(() => extractExpandables(content), [content]);
  const allIds = useMemo(() => Array.from(map.keys()), [map]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);
  const expandAll = useCallback(() => setExpandedIds(new Set(allIds)), [allIds]);

  return {
    shadow,
    expandablesMap: map,
    expandedIds,
    hasExpandables: allIds.length > 0,
    anyExpanded: expandedIds.size > 0,
    toggle,
    expandAll,
    collapseAll,
  };
};

interface DigTextContentProps {
  state: DigTextState;
  className?: string;
}

export const DigTextContent: React.FC<DigTextContentProps> = ({ state, className = "" }) => {
  const { shadow, expandedIds, toggle, expandablesMap } = state;

  return (
    <div
      className={cn(
        "text-lg leading-[1.85] font-serif",
        "[&_h1]:text-3xl [&_h1]:font-serif [&_h1]:font-semibold [&_h1]:mt-8 [&_h1]:mb-4",
        "[&_h2]:text-2xl [&_h2]:font-serif [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3",
        "[&_h3]:text-xl [&_h3]:font-serif [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2",
        "[&_h4]:text-lg [&_h4]:font-serif [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2",
        "[&_p]:my-4",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        "[&_a]:text-expand-button [&_a:hover]:text-expand-button-hover [&_a]:underline",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4",
        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4",
        "[&_li]:my-1",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-4",
        "[&_code]:font-mono [&_code]:text-sm [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded",
        "[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre]:my-4",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_hr]:my-8 [&_hr]:border-border",
        "[&_table]:w-full [&_table]:my-4 [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
        className,
      )}
    >
      <ShadowMarkdown
        shadow={shadow}
        expandedIds={expandedIds}
        toggle={toggle}
        expandablesMap={expandablesMap}
      />
    </div>
  );
};

const DigText: React.FC<DigTextProps> = ({
  content,
  className = "",
  contentClassName = "",
  showExpandAllButton = true,
}) => {
  const state = useDigTextState(content);
  const { hasExpandables, anyExpanded, expandAll, collapseAll } = state;

  return (
    <div className={className}>
      {showExpandAllButton && hasExpandables && (
        <div className="flex justify-end mb-4">
          <button
            onClick={anyExpanded ? collapseAll : expandAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-expand-button px-3 py-1 text-xs font-sans font-medium tracking-wider uppercase text-expand-button hover:bg-[hsl(var(--expand-button)/0.08)] hover:text-expand-button-hover hover:border-expand-button-hover transition-colors"
            type="button"
          >
            {anyExpanded ? <X size={12} strokeWidth={2.5} className="block" /> : <Plus size={12} strokeWidth={2.5} className="block" />}
            {anyExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}
      <DigTextContent state={state} className={contentClassName} />
    </div>
  );
};

export default DigText;
