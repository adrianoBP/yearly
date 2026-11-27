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
