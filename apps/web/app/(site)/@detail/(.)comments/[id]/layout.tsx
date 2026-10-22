import type {ReactNode} from "react";
import {DetailRouteBoundary} from "../../../_features/content/detail-layer";

// Keep the shell synchronous so Next can prefetch and show loading independently.
export default function Layout({children,params}:{children:ReactNode;params:Promise<{id:string}>}){
 return <DetailRouteBoundary type="comment" params={params}>{children}</DetailRouteBoundary>;
}
