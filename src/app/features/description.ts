const HTML_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;

/**
 * Event description as HTML for [innerHTML], which still runs it through Angular's sanitizer.
 * Google stores HTML, so that passes through; anything else is read as basic Markdown.
 */
export function descriptionHtml(text: string | null | undefined): string {
  if (!text) return '';
  if (HTML_TAG.test(text)) return text;

  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let html = '';
  let inList = false;
  let afterText = false;
  for (const line of escaped.split(/\r?\n/)) {
    const item = line.match(/^\s*[-*+]\s+(.*)/);
    if (item) {
      html += `${inList ? '' : '<ul>'}<li>${inline(item[1])}</li>`;
    } else {
      html += (inList ? '</ul>' : afterText ? '<br>' : '') + inline(line);
    }
    inList = !!item;
    afterText = !item;
  }
  return inList ? html + '</ul>' : html;
}

// shortcut: emphasis also matches inside a link's URL (e.g. /_x_/), upgrade to a tokenizer if that shows up
function inline(text: string): string {
  return text
    .replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|(https?:\/\/[^\s<]*[^\s<.,!?)])/g,
      (_, label, url, bare) => `<a href="${url ?? bare}">${label ?? bare}</a>`
    )
    .replace(/\*\*(.+?)\*\*|\b__(.+?)__\b/g, '<b>$1$2</b>')
    .replace(/\*(.+?)\*|\b_(.+?)_\b/g, '<i>$1$2</i>');
}
