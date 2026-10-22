import {getLinkPreview,checkWriteOrigin,readJson,errorResponse} from '@sohoin/core/server';
export const runtime='nodejs';
export async function POST(request:Request){
 try{checkWriteOrigin(request);return Response.json(await getLinkPreview(request.headers,await readJson(request,4096)),{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});}
 catch(error){const response=errorResponse(error);response.headers.set('X-Robots-Tag','noindex');return response;}
}
