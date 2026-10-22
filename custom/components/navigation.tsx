import type { NavigationProps } from "@sohoin/extension-api";

/** Replace the public navigation slot without importing Core internals. */
export function CustomNavigation({ brand, items, headerNote }: NavigationProps) {
  return <header className="site-header custom-header" data-component="custom-navigation">
    <a className="brand" href="#main-content"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 30 30" fill="none"><path d="M5 24 15 5l10 19M9 17h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>{brand}{headerNote && <span className="brand-note">{headerNote}</span>}</a>
    <nav aria-label="主导航">{items.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
  </header>;
}
