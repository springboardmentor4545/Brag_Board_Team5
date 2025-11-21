const ZERO_WIDTH_ZERO = '\u200B'; // zero-width space represents binary 0
const ZERO_WIDTH_ONE = '\u200C'; // zero-width non-joiner represents binary 1
const MENTION_START = '\u2060'; // word joiner marks start of encoded payload
const MENTION_END = '\u2061'; // function application marks end of payload

const ENCODED_MENTION_REGEX = new RegExp(
  `@([^${MENTION_START}]+)${MENTION_START}([${ZERO_WIDTH_ZERO}${ZERO_WIDTH_ONE}]+)${MENTION_END}`,
  'g'
);
const LEGACY_MENTION_REGEX = /@\[(.+?)\]\((\d+)\)/g;

const ZERO_RE = new RegExp(ZERO_WIDTH_ZERO, 'g');
const ONE_RE = new RegExp(ZERO_WIDTH_ONE, 'g');

function encodeIdToBits(id) {
  const ascii = String(id || '');
  let bits = '';
  for (const ch of ascii) {
    bits += ch.charCodeAt(0).toString(2).padStart(7, '0');
  }
  return bits;
}

function bitsToId(bits) {
  if (!bits) return '';
  const chars = [];
  for (let i = 0; i + 6 < bits.length; i += 7) {
    const chunk = bits.slice(i, i + 7);
    chars.push(String.fromCharCode(parseInt(chunk, 2)));
  }
  return chars.join('');
}

export function encodeMentionPayload(id) {
  const bits = encodeIdToBits(id);
  if (!bits) {
    return `${MENTION_START}${MENTION_END}`;
  }
  const zeroWidthBits = bits.replace(/0/g, ZERO_WIDTH_ZERO).replace(/1/g, ZERO_WIDTH_ONE);
  return `${MENTION_START}${zeroWidthBits}${MENTION_END}`;
}

export function decodeMentionPayload(zeroWidthBits) {
  if (!zeroWidthBits) return '';
  const bits = zeroWidthBits.replace(ZERO_RE, '0').replace(ONE_RE, '1');
  return bitsToId(bits);
}

export function parseMentions(text) {
  const mentions = [];
  if (!text) return mentions;

  ENCODED_MENTION_REGEX.lastIndex = 0;
  let match;
  while ((match = ENCODED_MENTION_REGEX.exec(text)) !== null) {
    const display = match[1];
    const encodedBits = match[2];
    const decoded = decodeMentionPayload(encodedBits);
    mentions.push({
      index: match.index,
      length: match[0].length,
      display,
      id: decoded,
      type: 'encoded',
    });
  }

  LEGACY_MENTION_REGEX.lastIndex = 0;
  while ((match = LEGACY_MENTION_REGEX.exec(text)) !== null) {
    const display = match[1];
    const id = match[2];
    mentions.push({
      index: match.index,
      length: match[0].length,
      display,
      id,
      type: 'legacy',
    });
  }

  mentions.sort((a, b) => a.index - b.index);
  return mentions;
}

export function extractMentionIds(text) {
  const ids = new Set();
  parseMentions(text).forEach((m) => {
    const parsed = parseInt(m.id, 10);
    if (Number.isFinite(parsed)) {
      ids.add(parsed);
    }
  });
  return Array.from(ids);
}

export const mentionEncodingConstants = {
  ZERO_WIDTH_ZERO,
  ZERO_WIDTH_ONE,
  MENTION_START,
  MENTION_END,
};
