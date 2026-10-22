import Link from "next/link";
import Form from "next/form";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {contentService} from "@/lib/content";
import {adminRead} from "@/lib/admin-page";
import {termKindSchema,termsQuerySchema} from "@sohoin/extension-api/content";
import {PageHeader,EmptyState} from "@sohoin/admin-ui/layout";
import {Card} from "@sohoin/admin-ui/card";
import {Input} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell,TableCaption} from "@sohoin/admin-ui/table";
import {TermForm} from "../_components/term-form";
import {DeleteRecord} from "../../../_components/shared/delete-record";
export default async function TaxonomyPage({params,searchParams}:{params:Promise<{kind:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const kind=termKindSchema.safeParse((await params).kind);if(!kind.success)notFound();const raw=await searchParams;const {edit,...rest}=raw;const parsed=termsQuerySchema.safeParse(rest);const title=kind.data==="categories"?"分类":"标签";const base="/admin/taxonomies/"+kind.data;
 if(!parsed.success)return <EmptyState title="查询参数无效" action={<Link href={base}>返回列表</Link>}/>;
 const page=await adminRead(async()=>contentService.terms(await headers(),kind.data,parsed.data));const selected=typeof edit==="string"?page.items.find(item=>item.id===edit):undefined;
 const link=(before?:string,selectedId?:string)=>{const p=new URLSearchParams();if(parsed.data.q)p.set("q",parsed.data.q);if(before)p.set("before",before);if(selectedId)p.set("edit",selectedId);return base+(p.size?"?"+p:"");};
 return <><PageHeader title={title+"管理"} description={kind.data==="categories"?"每篇内容选择一个主分类，前台也可将其称为板块。":"内容可关联多个标签，不自动生成标签页或话题导航。"}/><div className="taxonomy-grid"><Card><Form key={parsed.data.q} action={base} className="users-filters"><label className="users-search">搜索{title}<Input name="q" type="search" defaultValue={parsed.data.q} placeholder="名称前缀" maxLength={100}/></label><Button type="submit">查询</Button><Link href={base}>重置</Link></Form>
  {!page.items.length?<EmptyState title={"暂无匹配"+title} description="可通过新增表单创建。"/>:<Table><TableCaption>每页最多 30 条，按编号倒序。已被内容引用的项目不可直接删除。</TableCaption><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>标识</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{page.items.map(item=><TableRow key={item.id}><TableCell className="taxonomy-name"><Link href={link(parsed.data.before,item.id)}><span className="taxonomy-name-with-icon">{item.iconMediaId&&<img src={`/api/v1/admin/media/${item.iconMediaId}/file?variant=thumbnail`} width="28" height="28" alt="" loading="lazy" decoding="async"/>}{item.name}</span></Link></TableCell><TableCell className="taxonomy-slug">{item.slug}</TableCell><TableCell><DeleteRecord url={"/api/v1/admin/taxonomies/"+kind.data+"/"+item.id} version={item.version} label={item.name}/></TableCell></TableRow>)}</TableBody></Table>}
  <nav className="audit-pagination" aria-label={title+"分页"}><span>{parsed.data.before&&<Link href={link()}>返回首页</Link>}</span>{page.nextCursor&&<Link href={link(page.nextCursor)}>下一页</Link>}</nav>
 </Card><Card><div className="taxonomy-form-heading"><h2 className="user-section-title">{selected?"编辑":"新增"}{title}</h2>{selected&&<Link href={link(parsed.data.before)}>取消编辑</Link>}</div><TermForm key={kind.data+":"+(selected?.id??"new")} kind={kind.data} initial={selected}/></Card></div></>;
}
