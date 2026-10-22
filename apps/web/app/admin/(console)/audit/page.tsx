import {RelativeTime} from "@sohoin/ui/relative-time";
import {adminRead} from "@/lib/admin-page";
import Link from "next/link";
import {headers} from "next/headers";
import {listSettingsAudit,listUserAudit,listAccountAudit,listContentAudit,listMediaAudit,listCommentAudit,ServiceError} from "@sohoin/core/server";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import {Card} from "@sohoin/admin-ui/card";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell,TableCaption} from "@sohoin/admin-ui/table";
const names:Record<string,string>={siteName:"站点名称",logo:"Logo 设置",icons:"站点图标",reactionTypes:"表情设置",description:"站点简介",navigation:"导航设置",custom:"Custom 定制",role:"账号角色",banned:"启用/禁用",banReason:"禁用原因"};
const actions={password_changed:"修改密码并退出全部登录",session_revoked:"退出指定登录",other_sessions_revoked:"退出其他登录"};
const tabs=[{type:"settings",label:"站点设置"},{type:"content",label:"内容管理"},{type:"comments",label:"讨论管理"},{type:"media",label:"媒体管理"},{type:"users",label:"用户管理"},{type:"account",label:"账号安全"}];
export default async function AuditPage({searchParams}:{searchParams:Promise<{before?:string|string[];type?:string|string[]}>}){
 const {before,type="settings"}=await searchParams;
 if(typeof type!=="string"||!tabs.some(tab=>tab.type===type))return <EmptyState title="记录类型无效" action={<Link href="/admin/audit">返回操作记录</Link>}/>;
 const base="/admin/audit?type="+type;
 const query={...(before!==undefined?{before}:{})};const requestHeaders=await headers();
 let rows:{id:string;createdAt:string;actorName:string;actorEmail:string|null;target?:{id:string;name:string;email:string|null};labels:string[]}[];let nextCursor:string|null;
 try{
  if(type==="content"){const page=await adminRead(()=>listContentAudit(requestHeaders,query));nextCursor=page.nextCursor;rows=page.items.map(item=>({...item,labels:[({created:"新增",updated:"更新",deleted:"删除"}[item.action])+({content:"内容",categories:"分类",tags:"标签"}[item.kind])+"："+item.label]}));}
  else if(type==="comments"){const page=await adminRead(()=>listCommentAudit(requestHeaders,query));nextCursor=page.nextCursor;rows=page.items.map(item=>({...item,labels:[({hide:"隐藏单条",restore:"恢复单条",delete:"删除正文",hide_thread:"隐藏整串",show_thread:"恢复整串"}[item.action])+"：讨论 #"+item.commentId+"（内容 #"+item.contentId+"）"]}));}
  else if(type==="media"){const page=await adminRead(()=>listMediaAudit(requestHeaders,query));nextCursor=page.nextCursor;rows=page.items.map(item=>({...item,labels:[(item.action==="uploaded"?"上传图片：":"删除图片：")+item.label+"（#"+item.mediaId+"）"]}));}
  else if(type==="users"){const page=await adminRead(()=>listUserAudit(requestHeaders,query));nextCursor=page.nextCursor;rows=page.items.map(item=>({...item,target:{id:item.targetId,name:item.targetName,email:item.targetEmail},labels:item.changedFields.map(field=>names[field]??"其他资料")}));}
  else if(type==="account"){const page=await adminRead(()=>listAccountAudit(requestHeaders,query));nextCursor=page.nextCursor;rows=page.items.map(item=>({...item,labels:[actions[item.action]]}));}
  else{const page=await adminRead(()=>listSettingsAudit(requestHeaders,query));nextCursor=page.nextCursor;rows=page.items.map(item=>({...item,labels:item.changedFields.map(field=>names[field]??"其他设置")}));}
 }catch(error){if(error instanceof ServiceError&&error.status===400)return <EmptyState title="分页参数无效" description="请返回最新记录后重试。" action={<Link href={base}>查看最新记录</Link>}/>;throw error;}
 return <><PageHeader title="操作记录" description="查看已成功提交的设置、内容、讨论、媒体、用户权限和账号安全操作。记录只读。"/>
  <nav className="audit-tabs" aria-label="记录分类">{tabs.map(tab=><Link href={"/admin/audit?type="+tab.type} key={tab.type} aria-current={tab.type===type?"page":undefined}>{tab.label}</Link>)}</nav>
  <Card><div className="audit-toolbar"><p className="au-muted">每页最多 30 条，按记录编号倒序排列。</p><Badge>只读记录</Badge></div>
   {rows.length===0?<EmptyState title="暂无操作记录" description="此分类的成功操作会显示在这里。"/>:<Table><TableCaption>时间以北京时间显示，不返回密码、会话令牌或完整变更数据。</TableCaption><TableHeader><TableRow><TableHead>操作时间</TableHead><TableHead>操作人</TableHead>{type==="users"&&<TableHead>目标用户</TableHead>}<TableHead>修改内容</TableHead></TableRow></TableHeader><TableBody>{rows.map(item=><TableRow key={item.id}><TableCell className="audit-time"><RelativeTime dateTime={item.createdAt}/></TableCell><TableCell className="audit-identity">{item.actorName}{item.actorEmail&&<p className="au-muted">{item.actorEmail}</p>}</TableCell>{type==="users"&&<TableCell className="audit-identity">{item.target&&<><Link href={"/admin/users/"+encodeURIComponent(item.target.id)}>{item.target.name}</Link>{item.target.email&&<p className="au-muted">{item.target.email}</p>}</>}</TableCell>}<TableCell><div className="audit-fields">{item.labels.length?item.labels.map(label=><Badge key={label}>{label}</Badge>):<span className="au-muted">保存资料</span>}</div></TableCell></TableRow>)}</TableBody></Table>}
   <nav className="audit-pagination" aria-label="操作记录分页"><Link href={base}>返回最新记录</Link>{nextCursor&&<Link href={base+"&before="+nextCursor}>查看更早记录</Link>}</nav>
  </Card>
 </>;
}
