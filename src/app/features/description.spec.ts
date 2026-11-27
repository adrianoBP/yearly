import { SecurityContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { descriptionHtml } from './description';

describe('descriptionHtml', () => {
  it('passes Google HTML through untouched', () => {
    const html = '<b>Bring</b> snacks<br><a href="https://x.com">tickets</a>';
    expect(descriptionHtml(html)).toBe(html);
  });

  it('keeps plain-text line breaks and escapes stray brackets', () => {
    expect(descriptionHtml('line one\nline 2 < 3 & more')).toBe('line one<br>line 2 &lt; 3 &amp; more');
  });

  it('renders basic Markdown', () => {
    expect(descriptionHtml('**bold** and *it* or _it_, not snake_case_name')).toBe(
      '<b>bold</b> and <i>it</i> or <i>it</i>, not snake_case_name'
    );
    expect(descriptionHtml('[Tickets](https://x.com/t) or https://y.com/a.')).toBe(
      '<a href="https://x.com/t">Tickets</a> or <a href="https://y.com/a">https://y.com/a</a>.'
    );
    expect(descriptionHtml('Bring:\n- snacks\n* water\nThanks')).toBe(
      'Bring:<ul><li>snacks</li><li>water</li></ul>Thanks'
    );
  });

  it('renders headings and checkboxes', () => {
    expect(descriptionHtml('# Title\n[ ] Checkbox 1\n[x] Checkbox 2\n- [ ] in a list')).toBe(
      '<h1>Title</h1><span class="task">Checkbox 1</span><br><span class="task done">Checkbox 2</span><ul><li><span class="task">in a list</span></li></ul>'
    );
  });

  it('reads Markdown typed into Google, which stores it as HTML lines', () => {
    expect(descriptionHtml('## Plan<br>[x] <a href="https://x.com/_a_">book</a> **now**<br>- tea')).toBe(
      '<h2>Plan</h2><span class="task done"><a href="https://x.com/_a_">book</a> <b>now</b></span><ul><li>tea</li></ul>'
    );
  });

  it('reads Markdown added on new lines after Google HTML', () => {
    expect(
      descriptionHtml('Manage it: <a href=https://fresha.com/l/x>link</a><br/><br/>\n\n# Test\n[x] Test\n[ ] Other')
    ).toBe('Manage it: <a href=https://fresha.com/l/x>link</a><br><br><h1>Test</h1><span class="task done">Test</span><br><span class="task">Other</span>');
  });

  it('ignores newlines that only format HTML source', () => {
    expect(descriptionHtml('<ul>\n<li>a</li>\n<li>b</li>\n</ul>')).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  });

  it('keeps the task classes through the sanitizer', () => {
    const safe = TestBed.inject(DomSanitizer).sanitize(SecurityContext.HTML, descriptionHtml('[x] done'));
    expect(safe).toBe('<span class="task done">done</span>');
  });

  it('keeps unquoted links and <br/> from Google', () => {
    const sanitizer = TestBed.inject(DomSanitizer);
    const safe = sanitizer.sanitize(SecurityContext.HTML, descriptionHtml('<a href=https://myurl>http://myurl</a><br/><br/>'));
    expect(safe).toBe('<a href="https://myurl">http://myurl</a><br><br>');
  });

  it('treats Teams-style <url> links as plain text', () => {
    expect(descriptionHtml('Join<https://t.ms/a?x=1&y=2>\nby phone')).toBe(
      'Join&lt;<a href="https://t.ms/a?x=1&amp;y=2">https://t.ms/a?x=1&amp;y=2</a>&gt;<br>by phone'
    );
  });

  it('only links web and mail addresses', () => {
    expect(descriptionHtml('[x](javascript:alert(1))')).not.toContain('<a');
  });

  it('leaves nothing executable after Angular sanitises it', () => {
    const sanitizer = TestBed.inject(DomSanitizer);
    for (const input of [
      '<b>hi</b><script>alert(1)</script>',
      '<img src="x" onerror="alert(1)">',
      '<a href="javascript:alert(1)">x</a>',
    ]) {
      const safe = sanitizer.sanitize(SecurityContext.HTML, descriptionHtml(input)) ?? '';
      expect(safe).not.toMatch(/<script|onerror|href="javascript/i);
    }
  });
});
