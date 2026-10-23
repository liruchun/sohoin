import {Button} from "@sohoin/admin-ui/button";
import {ContentFilters} from "./_components/content-filters";
import {ServiceError} from "@sohoin/core/server";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {headers} from "next/headers";
import {adminRead} from "@/lib/admin-page";
import {contentService} from "@/lib/content";
import {adminContentQuerySchema} from "@sohoin/extension-api/content";
import {Card} from "@sohoin/admin-ui/card";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell,TableCaption} from "@sohoin/admin-ui/table";
const statuses={draft:"草稿",published:"已发布",archived:"已下架"};
export default async function ContentPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams;if(raw.type==="")delete raw.type;const parsed=adminContentQuerySchema.safeParse(raw);if(!parsed.success)return <EmptyState title="筛选参数无效" action={<Link href="/admin/content">返回内容列表</Link>}/>;
 const query=parsed.data;const requestHeaders=await headers();
 async function selected(kind:"categories"|"tags",id?:string){if(!id)return undefined;try{const {name,slug}=await contentService.term(requestHeaders,kind,id);return {id,name,slug};}catch(error){if(error instanceof ServiceError&&error.status===404)return {id,name:kind==="categories"?"已删除分类":"已删除标签",slug:""};throw error;}}
 let result;try{result=await adminRead(()=>Promise.all([contentService.list(requestHeaders,query),selected("categories",query.categoryId),selected("tags",query.tagId)]));}catch(error){if(error instanceof ServiceError&&error.status===400)return <EmptyState title="分页参数与排序不匹配" action={<Link href="/admin/content">返回内容列表</Link>}/>;throw error;}const [page,category,tag]=result;
 const link=(before?:string,filters:Partial<typeof query>={})=>{const params=new URLSearchParams();for(const [key,value] of Object.entries({...query,...filters}))if(value&&key!=="before"&&value!=="all")params.set(key,value);if(before)params.set("before",before);return "/admin/content"+(params.size?"?"+params:"");};
 return <><PageHeader title="内容管理" description="管理不同类型的内容、主分类与标签。" actions={<Button asChild><Link href="/admin/content/new">新建内容</Link></Button>}/><Card>
  <ContentFilters key={JSON.stringify(query)} query={query} types={contentService.types} category={category} tag={tag}/>
  {!page.items.length?<EmptyState title="暂无匹配内容" description="可以先管理分类和标签，再新建内容。"/>:<Table><TableCaption>每页最多 30 篇，按选择的方式排序。列表不加载正文。</TableCaption><TableHeader><TableRow><TableHead>标题</TableHead><TableHead>类型</TableHead><TableHead>分类</TableHead><TableHead>标签</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{page.items.map(item=><TableRow key={item.id}><TableCell className="content-list-title"><Link href={"/admin/content/"+item.id}>{item.title||item.excerpt.slice(0,50)||"未命名帖子"}</Link><div className="audit-fields">{item.featured&&<Badge>精选</Badge>}{item.pinLevel>0&&<Badge>{item.pinLevel} 级置顶</Badge>}</div></TableCell><TableCell>{contentService.types.find(type=>type.id===item.type)?.label??item.type}</TableCell><TableCell>{item.category?<Link href={link(undefined,{categoryId:item.category.id})}>{item.category.name}</Link>:"未分类"}</TableCell><TableCell><div className="audit-fields">{item.tags.map(tag=><Link key={tag.id} href={link(undefined,{tagId:tag.id})}><Badge>{tag.name}</Badge></Link>)}</div></TableCell><TableCell><Badge>{statuses[item.status]}</Badge></TableCell><TableCell><Link href={"/admin/content/"+item.id+"/preview"} target="_blank" rel="noopener noreferrer" prefetch={false}>预览</Link></TableCell></TableRow>)}</TableBody></Table>}
  <nav className="audit-pagination" aria-label="内容分页"><span>{query.before&&<Link href={link()}>返回首页</Link>}</span>{page.nextCursor&&<Link href={link(page.nextCursor)}>下一页</Link>}</nav>
 </Card></>;
}
