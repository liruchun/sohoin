"use client";
import {Disclosure} from "@sohoin/admin-ui/disclosure";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import Form from "next/form";
import {useState} from "react";
import type {ContentQuery} from "@sohoin/extension-api/content";
import {Input} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {TermPicker} from "./term-picker";
type Choice={id:string;name:string;slug:string};
export function ContentFilters({query,types,category,tag}:{query:ContentQuery;types:{id:string;label:string}[];category?:Choice;tag?:Choice}){
 const [categories,setCategories]=useState<Choice[]>(category?[category]:[]);const [tags,setTags]=useState<Choice[]>(tag?[tag]:[]);
 return <div className="content-filters"><Form id="content-filter-form" action="/admin/content"><div className="users-filters"><label className="users-search">搜索标题<Input name="q" type="search" defaultValue={query.q} maxLength={100} placeholder="标题前缀"/></label><label>类型<NativeSelect className="au-input" name="type" defaultValue={query.type??""}><option value="">全部类型</option>{!types.some(type=>type.id===query.type)&&query.type&&<option value={query.type}>{query.type}</option>}{types.map(type=><option key={type.id} value={type.id}>{type.label}</option>)}</NativeSelect></label><label>状态<NativeSelect className="au-input" name="status" defaultValue={query.status}><option value="all">全部状态</option><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已下架</option></NativeSelect></label><label>标记<NativeSelect className="au-input" name="featured" defaultValue={query.featured}><option value="all">全部内容</option><option value="yes">精选</option><option value="no">非精选</option></NativeSelect></label><label>置顶<NativeSelect className="au-input" name="pinned" defaultValue={query.pinned}><option value="all">全部</option><option value="yes">已置顶</option><option value="no">未置顶</option></NativeSelect></label><label>排序<NativeSelect className="au-input" name="sort" defaultValue={query.sort}><option value="latest">最新创建</option><option value="published">最新发布</option><option value="updated">最近更新</option><option value="priority">置顶优先</option></NativeSelect></label><Button type="submit">查询</Button><Link href="/admin/content">重置</Link></div>
  {categories[0]&&<input type="hidden" name="categoryId" value={categories[0].id}/>} {tags[0]&&<input type="hidden" name="tagId" value={tags[0].id}/>}
 </Form><Disclosure label="分类与标签筛选" className="content-filter-details" defaultOpen={Boolean(query.categoryId||query.tagId)}><div className="content-filter-pickers"><TermPicker kind="categories" choices={[]} selected={categories} onChange={setCategories} single lazy/><TermPicker kind="tags" choices={[]} selected={tags} onChange={setTags} single lazy/></div><p className="au-muted">可与标题、类型和状态一起筛选。</p><Button type="submit" form="content-filter-form">应用筛选</Button></Disclosure>
 </div>;
}
