import {useLocale,useTranslations} from "next-intl";
import {RelativeTime} from "@sohoin/ui/relative-time";
import styles from "./content-meta.module.css";
import {ReadingLink as Link} from "../feedback/reading-navigation";
import {communityHref} from "../../_features/community/community-route";
import {StaticIcon} from "./static-icon";
import type {SiteContent} from "@sohoin/core/server";
import {Fragment,type ReactNode} from "react";
import {ExternalLink} from "./external-link";
import {LinkifyIt,REBuilder} from "linkify-it";
import {mentionPattern} from '@sohoin/extension-api/mentions';

// Chinese prose often has no space before a URL. Extend only the prefix
// boundary via LinkifyIt's public builder; keep URL/path validation intact.
class ContentLinkREBuilder extends REBuilder {
 override get_schema_search():RegExp{
  if(this.cache.schema_search)return this.cache.schema_search;
  const base=super.get_schema_search();
  return this.cache.schema_search=new RegExp(base.source.replace("(^|","(^|[\\u3400-\\u9fff\\uf900-\\ufaff]|"),base.flags);
 }
}
const linkify=new LinkifyIt({fuzzyLink:false,fuzzyEmail:false,rebuilder:new ContentLinkREBuilder()}).add("ftp:",null).add("mailto:",null).add("//",null);

function bodyLinks(text:string,href?:string,truncated=false){
 const nodes:ReactNode[]=[];
 const plain=(value:string,key:number)=>href?<Link key={key} href={href} className={styles.bodyLink}>{value}</Link>:value;
 let offset=0;
 for(const match of linkify.match(text)??[]){
  // A server preview can end inside a URL: do not invent a shortened destination.
  if(truncated&&match.lastIndex===text.length)continue;
  let url:URL;
  try{url=new URL(match.raw);}catch{continue;}
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password)continue;
  if(match.index>offset)nodes.push(plain(text.slice(offset,match.index),offset));
  nodes.push(<ExternalLink key={match.index} href={match.raw} hostname={url.hostname}/>);
  offset=match.lastIndex;
 }
 if(offset<text.length)nodes.push(plain(text.slice(offset),offset));
 return nodes;
}

function bodyMentions(text:string,href?:string,truncated=false){
 const nodes:ReactNode[]=[];let offset=0;
 for(const match of text.matchAll(mentionPattern())){
  nodes.push(<Fragment key={`text-${offset}`}>{bodyLinks(text.slice(offset,match.index),href)}</Fragment>);
  nodes.push(<Link key={`mention-${match.index}`} href={'/members/'+match[1]} prefetch={false} className={styles.mention}>@{match[2]}</Link>);
  offset=match.index+match[0].length;
 }
 // Preserve readable labels for older imported mention syntax without treating
 // its private/source IDs as this site's public member routes.
 nodes.push(<Fragment key={`text-${offset}`}>{bodyLinks(text.slice(offset).replace(/<@[^|>]+\|([^>]+)>/g,'@$1'),href,truncated)}</Fragment>);
 return nodes;
}


export function ContentMeta({content,detail=false,compact=false,card=false,replyToName}:{content:SiteContent;detail?:boolean;compact?:boolean;card?:boolean;replyToName?:string|null}){
 const t=useTranslations("Web");
 const locale=useLocale();
 if(card)return <div className={styles.cardMeta}>
  <div className={styles.identity}>
   <div className={styles.nameRow}><Link href={"/members/"+content.author.publicId} prefetch={false} className={styles.author} data-skeleton-part="name">{content.author.name}</Link>
    {replyToName&&<span className={styles.replyTarget}><svg className={styles.replyArrow} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M6 3 21 12 6 21Z"/></svg><span className={styles.replyLabel}>{t("reply")}</span><span>{replyToName}</span></span>}
    {content.comment&&<RelativeTime locale={locale} dateTime={content.publishedAt} className={styles.commentDate} data-skeleton-part="meta"/>}
    {content.category&&(content.categorySlug?
     <Link href={communityHref({slug:content.categorySlug})} prefetch={false} className={styles.cardCategory}><StaticIcon name="chevron-right" size=".75rem"/><span data-skeleton-part="category">{content.category}</span></Link>:
     <span className={styles.cardCategory}><StaticIcon name="chevron-right" size=".75rem"/><span data-skeleton-part="category">{content.category}</span></span>)}
   </div>
   {!content.comment&&<RelativeTime locale={locale} dateTime={content.publishedAt} className="sr-only"/>}
  </div>
 </div>;
 return <div className={styles.meta} data-compact={compact}>
  <Link href={"/members/"+content.author.publicId} prefetch={detail?undefined:false} className={styles.author} data-skeleton-part="name">{content.author.name}</Link>
  {replyToName&&<span className={styles.replyTarget}><svg className={styles.replyArrow} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M6 3 21 12 6 21Z"/></svg><span className={styles.replyLabel}>{t("reply")}</span><span data-skeleton-part="name">{replyToName}</span></span>}
  {content.category&&(content.categorySlug?
   <Link href={communityHref({slug:content.categorySlug})} className={styles.categoryLink}>{!detail&&<StaticIcon name="chevron-right" size="1em"/>}<span data-skeleton-part="category">{content.category}</span></Link>:
   <>{!detail&&<StaticIcon name="chevron-right" size="1em" className={styles.category}/>}<span className={styles.category} data-skeleton-part="category">{content.category}</span></>)}
  <RelativeTime locale={locale} dateTime={content.publishedAt} className={styles.date} data-skeleton-part={compact?undefined:"meta"}/>
 </div>;
}

export function ContentBody({text,skeleton=true,truncated=false,ellipsis=true,href}:{text:string;skeleton?:boolean;truncated?:boolean;ellipsis?:boolean;href?:string}){
 // Render manual line breaks as paragraphs on the server; skip empty lines
 // without rewriting stored content or relying on browser-side conversion.
 const paragraphs=text.replace(/\r\n?/g,"\n").split("\n").filter(paragraph=>paragraph.trim().length>0);
 if(!paragraphs.length)return null;
 const render=(paragraph:string,index:number)=>{const last=index===paragraphs.length-1;return <>{bodyMentions(paragraph,href,truncated&&last)}{ellipsis&&truncated&&last?"…":null}</>;};
 if(paragraphs.length===1)return <p className={styles.body} data-skeleton-part={skeleton?"body":undefined}>{render(paragraphs[0],0)}</p>;
 return <div className={styles.body} data-skeleton-part={skeleton?"body":undefined}>
  {paragraphs.map((paragraph,index)=><p key={index}>{render(paragraph,index)}</p>)}
 </div>;
}
