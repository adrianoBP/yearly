import { Component, ElementRef, effect, inject, input } from '@angular/core';
import { IconNode } from 'lucide';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * A Lucide icon drawn as its separate strokes, so CSS can move each part (ICON MOTION in styles.css).
 * Use as `<svg [appIcon]="lucide.Trash2" />`; it follows the text size unless given a `size`.
 */
@Component({
  selector: 'svg[appIcon]',
  template: '',
  host: {
    class: 'lucide',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    '[attr.width]': 'size()',
    '[attr.height]': 'size()',
  },
})
export class IconComponent {
  appIcon = input.required<IconNode>();
  size = input('1em');

  constructor() {
    const svg: SVGSVGElement = inject(ElementRef).nativeElement;
    effect(() => {
      svg.replaceChildren(
        ...this.appIcon().map(([tag, attrs]) => {
          const part = document.createElementNS(SVG, tag);
          for (const [name, value] of Object.entries(attrs)) part.setAttribute(name, String(value));
          return part;
        }),
      );
    });
  }
}
