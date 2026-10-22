import type { HomeTitleProps, NavigationProps, PageTemplateProps } from "@sohoin/extension-api";

export function HomeTitle({ title }: HomeTitleProps) { return <h1>{title}</h1>; }

export function Navigation({ brand, items }: NavigationProps) {
  return <header className="site-header" data-component="core-navigation">
    <a className="brand" href="#main-content">{brand}</a>
    <nav aria-label="主导航">{items.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
  </header>;
}

export function PageTemplate({ children, navigation, sidebar, footer }: PageTemplateProps) {
  return <div className="community-page" data-theme="core" data-template="core">
    {navigation}
    <div className="page-grid">
      <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
      <aside className="sidebar" aria-label="社区导览">{sidebar}</aside>
    </div>
    {footer}
  </div>;
}
