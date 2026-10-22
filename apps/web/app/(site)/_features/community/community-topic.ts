import "server-only";
import {cache} from "react";
import {getSiteTopics,type SiteTopic} from "@sohoin/core/server";
import {indexingEnabled} from "@/lib/site";

/** Topics are small and shared by the page, metadata and the header slot. */
export const readCommunityTopics=cache(async():Promise<SiteTopic[]>=>getSiteTopics(indexingEnabled()));

export async function readCommunityTopic(slug:string){
 const topics=await readCommunityTopics();
 return topics.find(topic=>topic.slug===slug)??null;
}
