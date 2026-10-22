import type { PageTemplateProps } from "@sohoin/extension-api";

/** Keep all host slots; Custom owns their placement and the scoped theme. */
export function CustomCommunityTemplate({ children, navigation, sidebar, footer }: PageTemplateProps) {
  return <div className="community-page custom-community" data-theme="custom" data-template="custom">
    {navigation}
    <div className="page-grid">
      <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
      <aside className="sidebar" aria-label="社区导览">{sidebar}</aside>
    </div>
    {footer}
  </div>;
}
