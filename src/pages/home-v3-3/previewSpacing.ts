export interface InlineBulletNode {
  id: string;
  text: string;
  children: InlineBulletNode[];
}

export interface InlineParagraphNode {
  id: string;
  bullets: InlineBulletNode[];
  blankLinesBefore: number;
}

const DEFAULT_VISUAL_INDENT_UNIT = "    ";

const getLineBodyText = (rawLine: string) => {
  const match = rawLine.match(/^(\s*)(?:[-*+•]\s+)?(.*)/);
  return match ? match[2].trim() : "";
};

export const parseInlineDocument = (
  text: string,
  visualIndentUnit = DEFAULT_VISUAL_INDENT_UNIT,
): InlineParagraphNode[] => {
  const lines = text.split("\n");
  const paragraphs: InlineParagraphNode[] = [];
  let currentBullets: InlineBulletNode[] = [];
  let stack: InlineBulletNode[] = [];
  let nodeCounter = 0;
  let paraCounter = 0;
  let pendingBlankLines = 0;
  let currentBlankLinesBefore = 0;

  const flush = () => {
    if (currentBullets.length > 0) {
      paragraphs.push({
        id: `para-${paraCounter++}`,
        bullets: currentBullets,
        blankLinesBefore: currentBlankLinesBefore,
      });
      currentBullets = [];
      currentBlankLinesBefore = 0;
    }
    stack = [];
  };

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      flush();
      pendingBlankLines += 1;
      continue;
    }

    if (currentBullets.length === 0) {
      currentBlankLinesBefore = paragraphs.length === 0 ? 0 : pendingBlankLines;
    }
    pendingBlankLines = 0;

    const indentMatch = rawLine.match(/^[\t ]*/)?.[0] ?? "";
    const normalizedIndent = indentMatch.replace(/\t/g, visualIndentUnit);
    const depth = Math.floor(normalizedIndent.length / visualIndentUnit.length);
    const rest = rawLine.slice(indentMatch.length);
    const bulletMatch = rest.match(/^[-*+•]\s+(.*)$/);
    const bodyText = (bulletMatch ? bulletMatch[1] : rest).trim();
    if (!bodyText) continue;

    const node: InlineBulletNode = {
      id: `node-${nodeCounter++}`,
      text: bodyText,
      children: [],
    };

    while (stack.length > depth) stack.pop();
    if (stack.length === 0) {
      currentBullets.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  flush();
  return paragraphs;
};

export const getParagraphBreakCountsByLineId = (
  text: string,
  lineIds: readonly number[],
) => {
  const counts = new Map<number, number>();
  const rawLines = text.split("\n");
  let lineIndex = 0;
  let pendingBlankLines = 0;

  for (const rawLine of rawLines) {
    if (!getLineBodyText(rawLine)) {
      pendingBlankLines += 1;
      continue;
    }

    if (lineIndex > 0 && pendingBlankLines > 0 && lineIndex < lineIds.length) {
      counts.set(lineIds[lineIndex], pendingBlankLines);
    }

    pendingBlankLines = 0;
    lineIndex += 1;
  }

  return counts;
};
