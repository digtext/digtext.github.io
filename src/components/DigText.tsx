import React, { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";

/**
 * DigText markup format:
 * Use >>hidden text<< to mark expandable sections.
 * Nesting is not supported in this version.
 * 
 * Example:
 * "The sky is blue. >>It appears blue because molecules in the atmosphere scatter shorter wavelengths of light more than longer ones.<< This is basic physics."
 */

type Segment = {
  type: "visible" | "expandable";
  text: string;
  id: number;
};

function parseDigText(raw: string): Segment[] {
  const segments: Segment[] = [];
  let idCounter = 0;
  const regex = />>(.*?)<<|([^]*?)(?=>>|$)/gs;
  
  // Simpler approach: split by >> and <<
  const parts = raw.split(/(>>|<<)/);
  let inExpand = false;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === ">>") {
      inExpand = true;
      continue;
    }
    if (part === "<<") {
      inExpand = false;
      continue;
    }
    if (part.length === 0) continue;
    
    segments.push({
      type: inExpand ? "expandable" : "visible",
      text: part,
      id: idCounter++,
    });
  }
  
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

const DigText: React.FC<DigTextProps> = ({ content, className = "" }) => {
  const segments = parseDigText(content);
  const expandableIds = segments.filter(s => s.type === "expandable").map(s => s.id);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(expandableIds));
  }, [expandableIds]);

  const anyExpanded = expandedIds.size > 0;

  return (
    <div className={className}>
      {expandableIds.length > 0 && (
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
      <div className="text-lg leading-[1.85] font-serif">
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
                  {seg.text}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default DigText;
