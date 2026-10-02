import React, { memo } from "react";
import { Text, TextProps } from "react-native";

interface FormattedTextProps extends TextProps {
  text?: string;
  prefix?: string;
}

interface TextSegment {
  content: string;
  isBold?: boolean;
  isUnderline?: boolean;
  isItalic?: boolean;
}

const parseFormattedText = (rawText: string): TextSegment[] => {
  if (!rawText) return [];

  // Match tags: <b>...</b>, <strong>...</strong>, <u>...</u>, <i>...</i>, <em>...</em>, **...**
  const tagRegex = /(<[b|strong|u|i|em]>.*?<\/[b|strong|u|i|em]>|\*\*.*?\*\*)/gi;

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ content: rawText.slice(lastIndex, match.index) });
    }

    const fullMatch = match[0];
    let isBold = false;
    let isUnderline = false;
    let isItalic = false;

    if (/<b/i.test(fullMatch) || /<strong/i.test(fullMatch) || /^\*\*/.test(fullMatch)) {
      isBold = true;
    }
    if (/<u/i.test(fullMatch)) {
      isUnderline = true;
    }
    if (/<i/i.test(fullMatch) || /<em/i.test(fullMatch)) {
      isItalic = true;
    }

    const cleanContent = fullMatch
      .replace(/<\/?(b|strong|u|i|em)>/gi, "")
      .replace(/^\*\*|\*\*$/g, "");

    segments.push({
      content: cleanContent,
      isBold,
      isUnderline,
      isItalic,
    });

    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < rawText.length) {
    segments.push({ content: rawText.slice(lastIndex) });
  }

  return segments;
};

export const FormattedText = memo(({ text = "", prefix = "", style, ...props }: FormattedTextProps) => {
  const fullString = prefix ? `${prefix}${text}` : text;
  const segments = parseFormattedText(fullString);

  if (segments.length === 0) {
    return <Text style={style} {...props}>{fullString}</Text>;
  }

  return (
    <Text style={style} {...props}>
      {segments.map((seg, idx) => {
        const segStyles: any[] = [];
        if (seg.isBold) segStyles.push({ fontWeight: "bold" as const });
        if (seg.isUnderline) segStyles.push({ textDecorationLine: "underline" as const });
        if (seg.isItalic) segStyles.push({ fontStyle: "italic" as const });

        if (segStyles.length === 0) {
          return seg.content;
        }

        return (
          <Text key={idx} style={segStyles}>
            {seg.content}
          </Text>
        );
      })}
    </Text>
  );
});

export default FormattedText;
