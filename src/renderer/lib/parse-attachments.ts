export interface ParsedTopic {
  prompt: string;
  attachments: { name: string; content: string }[];
}

const ATTACHMENT_DELIMITER = "\n\n---\nAttachment: ";

export function parseTopic(topic: string): ParsedTopic {
  const idx = topic.indexOf(ATTACHMENT_DELIMITER);
  if (idx === -1) return { prompt: topic, attachments: [] };

  const prompt = topic.slice(0, idx);
  const rest = topic.slice(idx);
  const segments = rest.split(ATTACHMENT_DELIMITER).filter(Boolean);

  const attachments = segments.map((seg) => {
    const newline = seg.indexOf("\n");
    if (newline === -1) return { name: seg, content: "" };
    return { name: seg.slice(0, newline), content: seg.slice(newline + 1) };
  });

  return { prompt, attachments };
}
