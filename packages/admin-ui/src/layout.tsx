import type {ReactNode} from "react";
export {Badge} from "./badge";
export function PageHeader({title,description,actions}: {title:string;description?:string;actions?:ReactNode}) {
 return <div className="au-page-header"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="au-page-actions">{actions}</div>}</div>;
}
export function EmptyState({title,description,action}: {title:string;description?:string;action?:ReactNode}) {
 return <div className="au-empty"><h2>{title}</h2>{description&&<p>{description}</p>}{action}</div>;
}
