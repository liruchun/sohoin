import type {SiteContent} from "@sohoin/core/server";
import {ContentBody} from "./content-meta";
import {ContentMedia} from "./content-media";
import {CardText} from "./card-text";

/** Shared reading content only; each card owns its author, thread and actions. */
export function CardBody({text,media=[],priority=false,preview}:{text:string;media?:SiteContent["media"];priority?:boolean;preview?:{href:string;truncated:boolean;updatedAt:string}}){
 const body=<ContentBody text={text} truncated={preview?.truncated} ellipsis={!preview} href={preview?.href} skeleton={!preview}/>;
 return <>
  {preview?<CardText key={preview.updatedAt} href={preview.href} truncated={preview.truncated}>{body}</CardText>:body}
  <ContentMedia media={media} priority={priority}/>
 </>;
}
