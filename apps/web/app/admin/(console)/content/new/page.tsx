import Link from "next/link";
import {headers} from "next/headers";
import {contentService} from "@/lib/content";
import {adminRead} from "@/lib/admin-page";
import {PageHeader} from "@sohoin/admin-ui/layout";
import {ContentEditor} from "../_components/content-editor";
export default async function NewContentPage(){const requestHeaders=await headers();const [categories,tags]=await adminRead(()=>Promise.all([contentService.terms(requestHeaders,"categories",{}),contentService.terms(requestHeaders,"tags",{})]));return <><PageHeader title="新建内容" description="默认保存为草稿，发布前请选择主分类并填写正文。" actions={<Link href="/admin/content">返回内容列表</Link>}/><ContentEditor types={contentService.types} categoriesCursor={categories.nextCursor} tagsCursor={tags.nextCursor} categories={categories.items.map(({id,name,slug})=>({id,name,slug}))} tags={tags.items.map(({id,name,slug})=>({id,name,slug}))}/></>;}
