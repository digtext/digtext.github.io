import React, { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";

/**
 * DigText markup format:
 * Use >>text<< to mark expandable sections.
 * Nesting is supported: >>outer >>inner<< outer<<
 */

type Segment = {
  type: "visible" | "expandable";
  text: string;
  id: number;
  children: Segment[];
  depth: number;
};

let globalId = 0;

function parseDigText(raw: string, depth = 0): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let currentText = "";

  const flush = () => {
    if (currentText.length > 0) {
      segments.push({ type: "visible", text: currentText, id: globalId++, children: [], depth });
      currentText = "";
    }
  };

  while (i < raw.length) {
    if (raw[i] === ">" && raw[i + 1] === ">") {
      flush();
      // Find matching close, accounting for nesting
      let nestLevel = 1;
      let j = i + 2;
      while (j < raw.length && nestLevel > 0) {
        if (raw[j] === ">" && raw[j + 1] === ">") {
          nestLevel++;
          j += 2;
        } else if (raw[j] === "<" && raw[j + 1] === "<") {
          nestLevel--;
          if (nestLevel === 0) break;
          j += 2;
        } else {
          j++;
        }
      }
      const inner = raw.slice(i + 2, j);
      const children = parseDigText(inner, depth + 1);
      segments.push({ type: "expandable", text: inner, id: globalId++, children, depth });
      i = j + 2; // skip <<
    } else if (raw[i] === "<" && raw[i + 1] === "<") {
      // Shouldn't happen at this level, but safety
      i += 2;
    } else {
      currentText += raw[i];
      i++;
    }
  }
  flush();
  return segments;
}

interface ExpandButtonProps {
  isExpanded: boolean;
  onClick: () => void;
}

const ExpandButton: React.FC<ExpandButtonProps> = ({ isExpanded, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-expand-button text-expand-button hover:text-expand-button-hover hover:border-expand-button-hover transition-colors mx-0.5 align-middle cursor-pointer"
    aria-label={isExpanded ? "Collapse" : "Expand"}
  >
    {isExpanded ? <X size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={2.5} />}
  </button>
);

interface DigTextProps {
  content: string;
  className?: string;
}

function collectExpandableIds(segments: Segment[]): number[] {
  const ids: number[] = [];
  for (const seg of segments) {
    if (seg.type === "expandable") {
      ids.push(seg.id);
      ids.push(...collectExpandableIds(seg.children));
    }
  }
  return ids;
}

const SegmentRenderer: React.FC<{
  segments: Segment[];
  expandedIds: Set<number>;
  toggle: (id: number) => void;
}> = ({ segments, expandedIds, toggle }) => {
  return (
    <>
      {segments.map((seg) => {
        if (seg.type === "visible") {
          return <span key={seg.id}>{seg.text}</span>;
        }

        const isExpanded = expandedIds.has(seg.id);
        return (
          <span key={seg.id}>
            <ExpandButton isExpanded={isExpanded} onClick={() => toggle(seg.id)} />
            {isExpanded && (
              <span className="bg-expanded-bg rounded px-1 py-0.5 transition-all">
                <SegmentRenderer segments={seg.children} expandedIds={expandedIds} toggle={toggle} />
              </span>
            )}
          </span>
        );
      })}
    </>
  );
};

const DigText: React.FC<DigTextProps> = ({ content, className = "" }) => {
  globalId = 0;
  const segments = parseDigText(content);
  const allExpandableIds = collectExpandableIds(segments);
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
  const expandAll = useCallback(() => setExpandedIds(new Set(allExpandableIds)), [allExpandableIds]);

  const anyExpanded = expandedIds.size > 0;

  return (
    <div className={className}>
      {allExpandableIds.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={anyExpanded ? collapseAll : expandAll}
            className="flex items-center gap-1.5 text-xs font-sans font-medium tracking-wider uppercase text-expand-button hover:text-expand-button-hover transition-colors"
          >
            {anyExpanded ? <X size={12} /> : <Plus size={12} />}
            {anyExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}
      <div className="text-lg leading-[1.85] font-serif whitespace-pre-wrap">
        <SegmentRenderer segments={segments} expandedIds={expandedIds} toggle={toggle} />
      </div>
    </div>
  );
};

export default DigText;
