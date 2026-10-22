import {getTranslations} from "next-intl/server";
import styles from "./feed.module.css";
import type {ReactNode} from "react";
import {getReactionTypes,getSiteInteractions,type SiteContent,type SiteView} from "@sohoin/core/server";
import {headers} from "next/headers";
import {PostCard} from "./post-card";
import {FeedDetailData} from "../content/detail-data";
import {FeedPublication} from "./feed-publication";

export function FeedPanel({children,label}:{children:ReactNode;label?:string}){
 return <section aria-label={label} className={styles.panel}>{children}</section>;
}

export function FeedEmptyState({title,children,headingLevel=2}:{title:string;children:ReactNode;headingLevel?:1|2}){
 const Heading=headingLevel===1?"h1":"h2";
 return <div className={styles.empty} data-skeleton-item="">
  <Heading className={headingLevel===1?styles.heading1:styles.heading2} data-skeleton-part="title">{title}</Heading>
  <p className={styles.description} data-skeleton-part="body">{children}</p>
 </div>;
}

export async function SiteFeed({items,view,label}:{items:SiteContent[];view:SiteView;label:string}){
 const t=await getTranslations("Web");
 const [catalog,viewer]=items.length?await Promise.all([getReactionTypes(),headers().then(value=>getSiteInteractions(value,{ids:items.filter(item=>!item.comment).map(item=>item.publicId)}))]):[{items:[]},{items:[]}];
 const reactionOptions=catalog.items.map(({code,label,emoji,enabled})=>({code,label,emoji,enabled}));
 const own=new Map(viewer.items.map(item=>[item.publicId,item]));
 return <FeedDetailData items={items.map(item=>({...item,interaction:own.get(item.publicId)}))} label={label} className={styles.list}>
  <FeedPublication rows={items.map((post,index)=>({id:post.publicId,node:<PostCard post={post} priority={index===0} reactionOptions={reactionOptions} interaction={post.comment?.interaction??own.get(post.publicId)}/>}))} empty={<FeedEmptyState title={view==="articles"?t("noArticles"):t("noContent")}>{t("startConversation")}</FeedEmptyState>}/>
 </FeedDetailData>;
}

