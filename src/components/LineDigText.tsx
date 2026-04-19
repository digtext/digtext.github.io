import React, { useCallback, useMemo, useState } from "react";
import {
  DigCloseIcon,
  DigPlusIcon,
  digIconButtonClass,
} from "@/components/DigIcons";
import { cn } from "@/lib/utils";

/**
 * LineDigText — indented-line authoring format for dig text.
 *
 * Input: plain indented text (spaces/tabs) OR bulleted lists (-, *, +, •).
 * Bullet prefixes are handled transparently — depth comes from indentation.
 * Rendering uses vertical border lines instead of bullet points.
 */

export interface LineNode {
  id: number;
  text: string;
  children: LineNode[];
}

/** Parse both bulleted and plain indented text into a tree. */
export function parseIndentedText(raw: string): LineNode[] {
  const lines = raw.split("\n");
  let nextId = 0;

  const root: LineNode[] = [];
  const stack: { node: LineNode; indent: number }[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Try bullet match first: optional indent + bullet char + space + text
    const bulletMatch = line.match(/^(\s*)[-*+•]\s+(.*)/);
    let indent: number;
    let text: string;

    if (bulletMatch) {
      indent = bulletMatch[1].replace(/\t/g, "  ").length;
      text = bulletMatch[2].trim();
    } else {
      const plainMatch = line.match(/^(\s*)(.*)/);
      if (!plainMatch) continue;
      indent = plainMatch[1].replace(/\t/g, "  ").length;
      text = plainMatch[2].trim();
    }

    if (!text) continue;

    const node: LineNode = { id: nextId++, text, children: [] };

    // Pop stack until we find a parent with less indent
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, indent });
  }

  return root;
}

// ── Collect all IDs that have children ─────────────────────────────────

function collectExpandableIds(nodes: LineNode[]): number[] {
  const ids: number[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id);
      ids.push(...collectExpandableIds(node.children));
    }
  }
  return ids;
}

// ── State hook (exposed for reader) ────────────────────────────────────

export interface LineDigTextState {
  tree: LineNode[];
  expandedIds: Set<number>;
  hasExpandables: boolean;
  anyExpanded: boolean;
  toggle: (id: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

export const useLineDigTextState = (content: string): LineDigTextState => {
  const tree = useMemo(() => parseIndentedText(content), [content]);
  const allExpandableIds = useMemo(() => collectExpandableIds(tree), [tree]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(
    () => setExpandedIds(new Set(allExpandableIds)),
    [allExpandableIds],
  );
  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  return {
    tree,
    expandedIds,
    hasExpandables: allExpandableIds.length > 0,
    anyExpanded: expandedIds.size > 0,
    toggle,
    expandAll,
    collapseAll,
  };
};

// ── Rendering ──────────────────────────────────────────────────────────

interface LineItemProps {
  node: LineNode;
  expandedIds: Set<number>;
  toggle: (id: number) => void;
  depth: number;
}

const LineItem: React.FC<LineItemProps> = ({
  node,
  expandedIds,
  toggle,
  depth,
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <li className="list-none">
      <div className="flex items-baseline gap-1">
        {hasChildren && (
          <button
            onClick={() => toggle(node.id)}
            className={cn(
              digIconButtonClass,
              "relative -top-px",
            )}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            type="button"
          >
            {isExpanded ? <DigCloseIcon /> : <DigPlusIcon />}
          </button>
        )}
        <span
          className={cn(
            "font-serif text-lg leading-[1.85]",
            depth === 0 && "font-medium",
          )}
        >
          {node.text}
        </span>
        {hasChildren && !isExpanded && (
          <span className="font-sans text-sm text-neutral-400 dark:text-neutral-500 ml-1 select-none">
            …
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="ml-[7px] mt-0.5 border-l-[1.5px] border-neutral-200 dark:border-neutral-700 pl-5 flex flex-col gap-0.5">
          {node.children.map((child) => (
            <LineItem
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              toggle={toggle}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

// ── Content component (driven by external state) ──────────────────────

interface LineDigTextContentProps {
  state: LineDigTextState;
  className?: string;
}

export const LineDigTextContent: React.FC<LineDigTextContentProps> = ({
  state,
  className = "",
}) => {
  const { tree, expandedIds, toggle } = state;

  if (tree.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {tree.map((node) => (
        <LineItem
          key={node.id}
          node={node}
          expandedIds={expandedIds}
          toggle={toggle}
          depth={0}
        />
      ))}
    </ul>
  );
};

/** Strip bullet prefixes from pasted text, preserving indentation. */
export function stripBullets(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^(\s*)[-*+•]\s+/, "$1"))
    .join("\n");
}
