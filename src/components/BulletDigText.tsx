import React, { useCallback, useMemo, useState } from "react";
import {
  DigCloseIcon,
  DigPlusIcon,
  digIconButtonClass,
} from "@/components/DigIcons";
import { cn } from "@/lib/utils";

/**
 * BulletDigText — bullet-list authoring format for dig text.
 *
 * Input format (plain text with indented bullets):
 *   - Top-level visible text
 *     - Hidden detail (level 1)
 *       - Deeper detail (level 2)
 *   - Another top-level item
 *
 * Bullets can use -, *, +, or •. Indentation (2+ spaces or tab) determines depth.
 * Lines without a bullet prefix are treated as continuation of the previous item.
 */

export interface BulletNode {
  id: number;
  text: string;
  children: BulletNode[];
}

export function parseBullets(raw: string): BulletNode[] {
  const lines = raw.split("\n");
  let nextId = 0;

  interface StackEntry {
    node: BulletNode;
    indent: number;
  }

  const root: BulletNode[] = [];
  const stack: StackEntry[] = [];

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Match bullet line: optional indent + bullet char (-, *, +, •) + space + text
    const match = line.match(/^(\s*)[-*+•]\s+(.*)/);
    if (!match) {
      // Continuation line — append to last node's text
      if (stack.length > 0) {
        stack[stack.length - 1].node.text += " " + line.trim();
      }
      continue;
    }

    const indent = match[1].replace(/\t/g, "  ").length;
    const text = match[2];
    const node: BulletNode = { id: nextId++, text, children: [] };

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

function collectExpandableIds(nodes: BulletNode[]): number[] {
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

export interface BulletDigTextState {
  tree: BulletNode[];
  expandedIds: Set<number>;
  hasExpandables: boolean;
  anyExpanded: boolean;
  toggle: (id: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

export const useBulletDigTextState = (content: string): BulletDigTextState => {
  const tree = useMemo(() => parseBullets(content), [content]);
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

interface BulletItemProps {
  node: BulletNode;
  expandedIds: Set<number>;
  toggle: (id: number) => void;
  depth: number;
}

const BulletItem: React.FC<BulletItemProps> = ({
  node,
  expandedIds,
  toggle,
  depth,
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <li className="list-none">
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button
            onClick={() => toggle(node.id)}
            className={cn(
              digIconButtonClass,
              "mt-[0.35em] cursor-pointer",
            )}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            type="button"
          >
            {isExpanded ? (
              <DigCloseIcon />
            ) : (
              <DigPlusIcon />
            )}
          </button>
        ) : (
          <span className="mt-0 flex-none w-5 self-stretch flex items-center justify-center">
            <span className="w-[1.5px] h-full bg-neutral-300 dark:bg-neutral-600 rounded-full" />
          </span>
        )}
        <span
          className={cn(
            "font-serif text-lg leading-[1.85]",
            depth === 0 && "font-medium",
          )}
        >
          {node.text}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <ul className="ml-7 mt-1 flex flex-col gap-1.5">
          {node.children.map((child) => (
            <BulletItem
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

// ── Main component ────────────────────────────────────────────────────

interface BulletDigTextProps {
  content: string;
  className?: string;
}

const BulletDigText: React.FC<BulletDigTextProps> = ({
  content,
  className = "",
}) => {
  const { tree, expandedIds, toggle } = useBulletDigTextState(content);

  if (tree.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {tree.map((node) => (
        <BulletItem
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

// ── Content component (driven by external state) ──────────────────────

interface BulletDigTextContentProps {
  state: BulletDigTextState;
  className?: string;
}

export const BulletDigTextContent: React.FC<BulletDigTextContentProps> = ({
  state,
  className = "",
}) => {
  const { tree, expandedIds, toggle } = state;

  if (tree.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {tree.map((node) => (
        <BulletItem
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

export default BulletDigText;
