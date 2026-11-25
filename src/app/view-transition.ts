import { NgZone } from '@angular/core';

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

/**
 * Applies a state change inside a View Transition so the browser animates old -> new.
 * `type` is exposed as <html data-transition> for the CSS in styles.css.
 * The update runs back inside Angular's zone so the change is rendered before the "new" snapshot.
 */
/** Resolves once the new state is shown (after the animation, if any) */
export function withViewTransition(ngZone: NgZone, update: () => void, type = ''): Promise<void> {
  const doc = document as TransitionDocument;
  if (!doc.startViewTransition) {
    update();
    return Promise.resolve();
  }

  const root = document.documentElement;
  root.dataset['transition'] = type;
  const transition = doc.startViewTransition(() => ngZone.run(update));
  // Skipped transitions (hidden tab, rapid clicks) reject `ready`; the update still applies
  transition.ready.catch(() => {});
  return transition.finished.catch(() => {}).finally(() => delete root.dataset['transition']);
}
