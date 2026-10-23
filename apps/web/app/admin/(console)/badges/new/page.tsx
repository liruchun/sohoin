import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {headers} from "next/headers";
import {requireAdministrator} from "@sohoin/core/server";
import {adminRead} from "@/lib/admin-page";
import {PageHeader} from "@sohoin/admin-ui/layout";
import {Card,CardHeader,CardTitle,CardContent} from "@sohoin/admin-ui/card";
import {BadgeEditor} from "../../../_features/badges/badge-editor";
export const metadata={title:"新建勋章"};
export default async function NewBadgePage(){
 await adminRead(async()=>requireAdministrator(await headers()));
 return <><PageHeader title="新建勋章" actions={<Link href="/admin/badges">返回勋章列表</Link>}/><Card><CardHeader><CardTitle>基本信息</CardTitle></CardHeader><CardContent><BadgeEditor/></CardContent></Card></>;
}
