import {contentService} from "@/lib/content";
export async function GET(){return Response.json(contentService.types,{headers:{"Cache-Control":"no-store"}});}
