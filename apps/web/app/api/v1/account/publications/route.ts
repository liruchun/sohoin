import {getPublishingOptions,publishMemberContent,checkWriteOrigin,readJson,errorResponse} from '@sohoin/core/server';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
export async function GET(request:Request){try{return Response.json(await getPublishingOptions(request.headers),{headers});}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{checkWriteOrigin(request);return Response.json(await publishMemberContent(request.headers,await readJson(request,65536)),{status:201,headers});}catch(error){return errorResponse(error);}}
