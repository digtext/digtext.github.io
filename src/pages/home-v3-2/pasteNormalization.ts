const getGcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }

  return x || 1;
};

const inferSpaceIndentUnit = (text: string) => {
  const counts = text
    .split("\n")
    .map((line) => (line.match(/^ +/)?.[0].length ?? 0))
    .filter((count) => count > 0);

  if (counts.length === 0) return 2;

  const gcd = counts.reduce((acc, count) => getGcd(acc, count));
  if (gcd === 2 || gcd === 4) return gcd;
  if (counts.every((count) => count % 4 === 0)) return 4;
  return 2;
};

const LIST_MARKER_PATTERN = /^((?:[-+*•])|(?:\d+[.)])|(?:[A-Za-z][.)]))\s+/;

const isListLikeLine = (line: string) =>
  LIST_MARKER_PATTERN.test(line.trimStart());

const hasListSpacerAroundIt = (lines: string[], index: number) => {
  let previousIndex = index - 1;
  while (previousIndex >= 0 && !lines[previousIndex].trim()) {
    previousIndex -= 1;
  }

  let nextIndex = index + 1;
  while (nextIndex < lines.length && !lines[nextIndex].trim()) {
    nextIndex += 1;
  }

  if (previousIndex < 0 || nextIndex >= lines.length) return false;

  return (
    isListLikeLine(lines[previousIndex]) && isListLikeLine(lines[nextIndex])
  );
};

export const normalizePastedListText = (text: string, indentToken = "\t") => {
  const normalizedNewlines = text.replace(/\r\n?/g, "\n");
  const lines = normalizedNewlines.split("\n");
  const hasAnyListMarker = lines.some((line) => isListLikeLine(line));

  if (!hasAnyListMarker) return normalizedNewlines;

  const spaceIndentUnit = inferSpaceIndentUnit(normalizedNewlines);

  return lines
    .flatMap((line, index) => {
      if (!line.trim()) {
        return hasListSpacerAroundIt(lines, index) ? [] : [""];
      }

      const leadingWhitespace = line.match(/^[\t ]*/)?.[0] ?? "";
      const textWithoutIndent = line.slice(leadingWhitespace.length);
      const bulletMatch = textWithoutIndent.match(LIST_MARKER_PATTERN);

      if (!bulletMatch) return [line];

      const tabs = (leadingWhitespace.match(/\t/g) ?? []).length;
      const spaces = (leadingWhitespace.match(/ /g) ?? []).length;
      const indentLevel = tabs + Math.floor(spaces / spaceIndentUnit);
      const normalizedText = textWithoutIndent.slice(bulletMatch[0].length);

      if (!normalizedText.trim()) return [];

      return [`${indentToken.repeat(indentLevel)}* ${normalizedText.trim()}`];
    })
    .join("\n");
};
