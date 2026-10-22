import Link from "next/link";

export function AdminBrand({name,href,subtitle=false}:{name:string;href:string;subtitle?:boolean}){
 const initial=Array.from(name)[0];
 return <Link className="console-brand" href={href} prefetch={false} aria-label={subtitle?name+"管理后台":name+"首页"}>
  <span className="console-brand-mark" aria-hidden="true">{initial}</span>
  <span className={subtitle?"console-brand-name":undefined}>{name}{subtitle&&<span>管理后台</span>}</span>
 </Link>;
}
