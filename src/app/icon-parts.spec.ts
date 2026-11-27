import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as lucide from 'lucide';
import { IconComponent } from './shared/icon/icon.component';

// The part animations in styles.css (ICON MOTION) pick strokes by position: a Lucide update that redraws one of these
// icons fails here instead of silently animating the wrong stroke.
const parts: [string, lucide.IconNode, string[]][] = [
  ['i-out: arrow head, arrow, door', lucide.LogOut, ['m16 17 5-5-5-5', 'M21 12H9', 'door']],
  ['i-pop: arrow head, arrow, box', lucide.ExternalLink, ['M15 3h6v6', 'M10 14 21 3', 'box']],
  ['i-lid: bin lines, bin, lid, handle', lucide.Trash2, ['M10 11v6', 'M14 11v6', 'bin', 'M3 6h18', 'handle']],
  ['i-grow: axis, then bars', lucide.ChartColumn, ['axis', 'M18 17V9', 'M13 17V5', 'M8 17v-3']],
  ['i-press: keys, space bar, frame last', lucide.Keyboard, ['M10 8h.01', 'M12 12h.01', 'M14 8h.01', 'M16 12h.01', 'M18 8h.01', 'M6 8h.01', 'M7 16h10', 'M8 12h.01', 'rect']],
  ['i-dots: middle, right, left', lucide.Ellipsis, ['circle 12', 'circle 19', 'circle 5']],
  ['i-chat: front bubble, back bubble', lucide.MessagesSquare, ['front', 'back']],
  ['i-plus: plus strokes 1st and 3rd', lucide.CalendarPlus, ['M16 18h6', 'M16 2v3', 'M19 15v6', 'frame', 'M3 9h18', 'M8 2v3']],
  ['i-swing: three fronds, trunk last', lucide.TreePalm, ['frond', 'frond', 'frond', 'trunk']],
  ['i-drop: pin, map, pin dot', lucide.MapPinned, ['pin', 'map', 'circle 12']],
  ['i-pin: needle, head', lucide.Pin, ['M12 17v5', 'head']],
  ['i-days: frame (4 parts), then 6 days', lucide.CalendarDays, ['M8 2v3', 'M16 2v3', 'rect', 'M3 9h18', 'M8 13h.01', 'M12 13h.01', 'M16 13h.01', 'M8 17h.01', 'M12 17h.01', 'M16 17h.01']],
];

describe('Icon parts', () => {
  for (const [name, icon, expected] of parts) {
    it(name, () => {
      expect(icon.length).withContext('number of parts').toBe(expected.length);
      // Short labels stand for long paths; only the exact paths and circle centres are compared
      icon.forEach(([tag, attrs], i) => {
        if (expected[i].startsWith('circle ')) expect(`${tag} ${attrs['cx']}`).toBe(expected[i]);
        else if (expected[i] === 'rect') expect(tag).toBe('rect');
        else if (/^[mM][\d.-]/.test(expected[i])) expect(attrs['d']).toBe(expected[i]);
        else expect(tag).withContext(expected[i]).toBe('path');
      });
    });
  }

  it('draws each part as its own element and keeps the i-* class', () => {
    @Component({ imports: [IconComponent], template: `<svg class="i-lid" [appIcon]="icon"></svg>` })
    class Host {
      icon = lucide.Trash2;
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const svg: SVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.classList).toContain('lucide');
    expect(svg.classList).toContain('i-lid');
    expect(Array.from(svg.children).map((part) => part.getAttribute('d'))).toEqual(lucide.Trash2.map(([, attrs]) => String(attrs['d'])));
  });
});
