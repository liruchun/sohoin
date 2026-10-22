import {searchMemberMentions,errorResponse} from '@sohoin/core/server';

export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 try{return Response.json(await searchMemberMentions(request.headers,params.get('q')??'',params.get('recent')??''),{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});}
 catch(error){return errorResponse(error);}
}
