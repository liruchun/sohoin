import {RelativeTime} from "@sohoin/ui/relative-time";
import type { ComponentType, ReactNode } from "react";
import { coreSettingsDefaults, type SiteSettings } from "@sohoin/extension-api/settings";
import type { Customization } from "@sohoin/extension-api";
import type {ContentSummary,PublicContent} from "@sohoin/extension-api/content";
import { HomeTitle, Navigation, PageTemplate } from "@sohoin/ui";

const notes = [
  { id: "starting", title: "从一个小想法开始", category: "随手记录", text: "留下一段观察，或是一个还没想清楚的问题。", detail: "建站时遇到的一个小问题，也可以成为交流的起点。" },
  { id: "making", title: "把过程也分享出来", category: "创作过程", text: "成品之外，草稿、尝试和取舍也值得被看见。把过程写下来，让下一次交流有一个具体的起点。", detail: "记录尝试过的方法、遇到的问题，以及最后做出选择的原因。" },
  { id: "reading", title: "给认真阅读留一点空间", category: "阅读笔记", text: "不急着滚动到下一条。一个清楚的标题、一段舒服的文字，有时已经足够。", detail: "读到有启发的经验，记下自己的理解，留待下一次实践。" },
];

export function HomeShell({ customization, settings = coreSettingsDefaults, published=[], links={contentList:()=>"/content",contentDetail:(id:string)=>"/content/"+encodeURIComponent(id)}, LinkComponent="a" }: { customization: Customization; settings?: SiteSettings;published?:ContentSummary[];links?:{contentList:()=>string;contentDetail:(id:string)=>string};LinkComponent?:ComponentType<{href:string;children:ReactNode}>|"a" }) {
  const Title = customization.components.HomeTitle ?? HomeTitle;
  const Header = customization.components.Navigation ?? Navigation;
  const Template = customization.templates.Page ?? PageTemplate;
  return <Template
    navigation={<Header brand={settings.siteName} items={settings.navigation.filter(item=>item.visible)} headerNote={settings.custom.headerNote} />}
    sidebar={<>
      <section id="topics"><h2>从这里逛起</h2><ul className="topic-list">{published.length?<li><LinkComponent href={links.contentList()}>全部内容</LinkComponent></li>:notes.map(note => <li key={note.id}><a href={"#" + note.id}>{note.category}</a></li>)}</ul></section>
      <section id="about" className="about"><h2>给交流留个位置</h2><p>与 SOHO 同行分享经验，交流自主工作中的问题。</p></section>
    </>}
    footer={<footer className="site-footer"><span>{settings.siteName}</span><span>记录 · 创作 · 交流</span></footer>}
  >
    <section className="introduction"><Title title="把值得分享的，留在这里。" /><p>{settings.description}</p></section>
    <section id="notes" aria-labelledby="notes-heading"><div className="section-heading"><h2 id="notes-heading">社区随记</h2>{published.length?<LinkComponent href={links.contentList()}>查看全部内容</LinkComponent>:null}</div>
      {published.length?<div className="note-list">{published.map(item=><article className="note" key={item.id}><h3><LinkComponent href={links.contentDetail(item.id)}>{item.title||"查看帖子"}</LinkComponent></h3>{item.excerpt&&<p>{item.excerpt}</p>}{item.category&&<span className="note-category">{item.category.name}</span>}</article>)}</div>:<div className="note-list">{notes.map(note => <article className="note" id={note.id} key={note.id}>
        <h3>{note.title}</h3><p>{note.text}</p><details><summary>展开随记</summary><p>{note.detail}</p></details><span className="note-category">{note.category}</span>
      </article>)}</div>}
    </section>
  </Template>;
}

export function ContentArticle({content}:{content:PublicContent}){
 return <article className="published-article"><h1>{content.title||(content.type==="post"?"社区帖子":"内容")}</h1><div className="published-meta">{content.category&&<span>{content.category.name}</span>}{content.publishedAt&&<RelativeTime dateTime={content.publishedAt}/>}</div>{content.excerpt&&<p className="published-excerpt">{content.excerpt}</p>}<div className="published-body">{content.body}</div>{content.tags.length>0&&<ul className="published-tags" aria-label="标签">{content.tags.map(tag=><li key={tag.id}>{tag.name}</li>)}</ul>}</article>;
}
