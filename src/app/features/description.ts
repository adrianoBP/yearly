// Known tags only, so plain text like Teams' "<https://…>" links isn't mistaken for HTML
const HTML_TAG =
  /<\/?(a|b|i|u|s|em|strong|br|p|div|span|font|ul|ol|li|h[1-6]|hr|img|table|thead|tbody|tr|td|th|blockquote|pre|code|sub|sup|small)\b[^>]*>/i;

/**
 * Event description as HTML for [innerHTML], which still runs it through Angular's sanitizer.
 * Google stores HTML, so that passes through; plain text is read as basic Markdown.
 * Markdown typed in Google's own editor arrives as HTML lines between <br>s, so those lines get the same treatment.
 */
export function descriptionHtml(text: string | null | undefined): string {
  if (!text) return '';
  const isHtml = HTML_TAG.test(text);
  const lines = isHtml
    ? text.split(/<br\s*\/?>/i)
    : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').split(/\r?\n/);

  let html = '';
  let prev = '';
  for (const line of lines) {
    const heading = line.match(/^\s*(#{1,6})\s+(.*)/);
    const item = heading ? null : line.match(/^\s*[-*+]\s+(.*)/);
    const kind = heading ? 'h' : item ? 'li' : 'text';
    if (prev === 'li' && kind !== 'li') html += '</ul>';
    if (kind === 'li' && prev !== 'li') html += '<ul>';
    if (kind === 'text' && prev === 'text') html += '<br>';

    const body = inline((heading?.[2] ?? item?.[1] ?? line).replace(/^\s*\[([ xX])\]\s+/, (_, c) => (c === ' ' ? '☐ ' : '☑ ')), !isHtml);
    html += heading ? `<h${heading[1].length}>${body}</h${heading[1].length}>` : item ? `<li>${body}</li>` : body;
    prev = kind;
  }
  return prev === 'li' ? html + '</ul>' : html;
}

function inline(text: string, links: boolean): string {
  if (links) {
    text = text.replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|(https?:\/\/(?:[^\s<&]|&amp;)*[^\s<&.,!?)])/g,
      (_, label, url, bare) => `<a href="${url ?? bare}">${label ?? bare}</a>`
    );
  }
  // Emphasis only in the text between tags, never inside them (URLs, attributes)
  return text
    .split(/(<[^>]*>)/)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/\*\*(.+?)\*\*|\b__(.+?)__\b/g, '<b>$1$2</b>').replace(/\*(.+?)\*|\b_(.+?)_\b/g, '<i>$1$2</i>')
    )
    .join('');
}
