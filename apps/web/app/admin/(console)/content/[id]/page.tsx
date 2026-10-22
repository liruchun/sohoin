import Link from "next/link";
import {headers} from "next/headers";
import {contentService} from "@/lib/content";
import {adminRead} from "@/lib/admin-page";
import {ServiceError} from "@sohoin/core/server";
import {PageHeader,EmptyState} from "@sohoin/admin-ui/layout";
import {ContentEditor} from "../_components/content-editor";
export default async function EditContentPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const requestHeaders=await headers();let data;try{data=await adminRead(()=>Promise.all([contentService.get(requestHeaders,id),contentService.terms(requestHeaders,"categories",{}),contentService.terms(requestHeaders,"tags",{})]));}catch(error){if(error instanceof ServiceError&&[400,404].includes(error.status))return <EmptyState title="内容不存在" action={<Link href="/admin/content">返回内容列表</Link>}/>;throw error;}const [initial,categories,tags]=data;return <><PageHeader title="编辑内容" description="已发布的内容保存后会立即更新前台。" actions={<Link href="/admin/content">返回内容列表</Link>}/><ContentEditor key={initial.id} initial={initial} types={contentService.types} categoriesCursor={categories.nextCursor} tagsCursor={tags.nextCursor} categories={categories.items.map(({id,name,slug})=>({id,name,slug}))} tags={tags.items.map(({id,name,slug})=>({id,name,slug}))}/></>;}
