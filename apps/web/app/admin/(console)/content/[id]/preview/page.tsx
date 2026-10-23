import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {headers} from "next/headers";
import {contentService} from "@/lib/content";
import {adminRead} from "@/lib/admin-page";
import {ServiceError} from "@sohoin/core/server";
import {ContentArticle} from "@sohoin/core";
import {Card} from "@sohoin/admin-ui/card";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import type {PublicContent} from "@sohoin/extension-api/content";
import "@/app/admin/(console)/content/_components/content-preview.css";
export const dynamic="force-dynamic";
export const metadata={title:"管理员内容预览",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function PreviewPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;let saved;try{saved=await adminRead(async()=>contentService.get(await headers(),id));}catch(error){if(error instanceof ServiceError&&[400,404].includes(error.status))return <EmptyState title="内容不存在" action={<Link href="/admin/content">返回列表</Link>}/>;throw error;}
 const {type,title,excerpt,body,category,tags,publishedAt}=saved;const content:PublicContent={id:saved.id,type,title,excerpt,body,category,tags,publishedAt,featured:saved.featured,featuredAt:saved.featuredAt,pinLevel:saved.pinLevel,data:contentService.publicData(type,saved.data,saved.dataSchemaVersion)};const Template=contentService.template(type)??ContentArticle;
 return <><PageHeader title="内容预览" description="仅管理员可见，展示最后保存的正文，不包含未保存修改。" actions={<Link href={"/admin/content/"+saved.id}>返回编辑</Link>}/><div className="content-preview-note"><Badge>{({draft:"草稿",published:"已发布",archived:"已下架"})[saved.status]}</Badge><span>保存版本 {saved.version}</span></div><Card className="content-preview"><Template content={content}/></Card></>;
}
