import {getFollowingActivities,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request){try{return Response.json(await getFollowingActivities(request.headers,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
