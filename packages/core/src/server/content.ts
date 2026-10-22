import {checkExtensionDefinition,prepareContentData,publicContentData} from "./content-data";
import "server-only";
import {ContentStoreError,readTerms,readTerm,writeTerm,deleteTerm,readContentList,readContent,writeContent,deleteContent,type ContentRow} from "@sohoin/database";
import {contentCursorSchema,contentIdSchema,typeIdSchema,termKindSchema,termInputSchema,updateTermSchema,deleteContentSchema,termsQuerySchema,contentValueSchema,updateContentSchema,publicContentQuerySchema,adminContentQuerySchema,type ContentSummary,type PublicContent,type AdminContent} from "@sohoin/extension-api/content";
import type {ContentTypeDefinition} from "@sohoin/extension-api";
import {requireAdministrator,enforceLimit,ServiceError} from "./security";
function parse<T>(schema:{safeParse:(input:unknown)=>{success:true;data:T}|{success:false;error:{issues:{message:string}[]}}},input:unknown):T{
 const result=schema.safeParse(input);if(!result.success)throw new ServiceError(400,"INVALID_CONTENT_INPUT",result.error.issues[0]?.message??"内容参数无效");return result.data;
}

function listing(query:ReturnType<typeof adminContentQuerySchema.parse>){if(!query.before||/^\d+$/.test(query.before)){if(query.before&&query.sort!=="latest")throw new ServiceError(400,"INVALID_CURSOR","请使用当前排序返回的分页游标");return query;}try{const cursor=contentCursorSchema.parse(JSON.parse(Buffer.from(query.before,"base64url").toString("utf8")));if(cursor.sort!==query.sort||query.sort==="latest")throw new Error();return {...query,before:undefined,cursor};}catch{throw new ServiceError(400,"INVALID_CURSOR","分页游标与排序不匹配");}}
function next(rows:ContentRow[],sort:string){if(rows.length<=30)return null;const row=rows[29];return sort==="latest"?row.id:Buffer.from(JSON.stringify({sort,id:row.id,at:row.sort_at,pin:row.pin_level})).toString("base64url");}

function summary(row:ContentRow):ContentSummary{return {id:row.id,type:row.type,title:row.title,excerpt:row.excerpt,category:row.category,tags:row.tags,publishedAt:row.published_at?.toISOString()??null,featured:row.featured,featuredAt:row.featured_at?.toISOString()??null,pinLevel:row.pin_level};}
function admin(row:ContentRow):AdminContent{return {...summary(row),body:row.body??"",media:row.media??[],data:row.data??{},dataSchemaVersion:row.data_schema_version??0,status:row.status,version:row.version,updatedAt:row.updated_at.toISOString()};}
async function store<T>(run:()=>Promise<T>):Promise<T>{try{return await run();}catch(error){
 if(error instanceof ContentStoreError){const errors={forbidden:[403,"FORBIDDEN","当前账号没有管理权限"],missing:[404,"CONTENT_NOT_FOUND","内容、分类或标签不存在"],conflict:[409,"CONTENT_CONFLICT","记录已被修改，或标识已被占用，请刷新后重试"],in_use:[409,"TERM_IN_USE","分类或标签仍被内容引用，请先调整关联"],published:[409,"CONTENT_PUBLISHED","请先下架内容，再执行删除"],invalid_reference:[400,"INVALID_REFERENCE","选择的分类、标签或媒体已失效，请重新选择"]} as const;const [status,code,message]=errors[error.code];throw new ServiceError(status,code,message);}throw error;
}}
async function access(headers:Headers,write=false){const actor=await requireAdministrator(headers);await enforceLimit(write?"content-write":"content-read",actor.id,write?30:120,60);return actor;}
export function createContentService(definitions:readonly ContentTypeDefinition[]=[]){
 const types=new Map<string,ContentTypeDefinition>([["article",{id:"article",label:"普通文章"}],["post",{id:"post",label:"社区帖子"}]]);const seen=new Set<string>();
 for(const definition of definitions){if(!typeIdSchema.safeParse(definition.id).success||seen.has(definition.id)||!definition.label.trim()||definition.label.length>40)throw new Error("Invalid content type registration");checkExtensionDefinition(definition.extension);seen.add(definition.id);types.set(definition.id,definition);}
 function known(type:string){if(!types.has(type))throw new ServiceError(400,"UNKNOWN_CONTENT_TYPE","此内容类型尚未注册");}
 return {
  types:[...types.values()].map(({id,label})=>({id,label})),
  template:(type:string)=>types.get(type)?.Template,
  publicData:(type:string,data:Parameters<typeof publicContentData>[1],schemaVersion:number)=>publicContentData(types.get(type)?.extension,data,schemaVersion),
  async term(headers:Headers,kind:unknown,id:unknown){await access(headers);const row=await readTerm(parse(termKindSchema,kind),parse(contentIdSchema,id));if(!row)throw new ServiceError(404,"TERM_NOT_FOUND","分类或标签不存在");return row;},
  async terms(headers:Headers,kind:unknown,input:unknown){await access(headers);const query=parse(termsQuerySchema,input);const rows=await readTerms(parse(termKindSchema,kind),query.q,query.before);const items=rows.slice(0,30);return {items,nextCursor:rows.length>30?items[items.length-1].id:null};},
  async createTerm(headers:Headers,kind:unknown,input:unknown){const actor=await access(headers,true);return store(()=>writeTerm(actor.id,parse(termKindSchema,kind),parse(termInputSchema,input)));},
  async updateTerm(headers:Headers,kind:unknown,id:unknown,input:unknown){const actor=await access(headers,true);const value=parse(updateTermSchema,input);return store(()=>writeTerm(actor.id,parse(termKindSchema,kind),value.value,parse(contentIdSchema,id),value.version));},
  async removeTerm(headers:Headers,kind:unknown,id:unknown,input:unknown){const actor=await access(headers,true);const value=parse(deleteContentSchema,input);return store(()=>deleteTerm(actor.id,parse(termKindSchema,kind),parse(contentIdSchema,id),value.version));},
  async list(headers:Headers,input:unknown){await access(headers);const query=parse(adminContentQuerySchema,input);const rows=await readContentList(listing(query));const items=rows.slice(0,30).map(row=>{const {body,media,data,dataSchemaVersion,...item}=admin(row);return item;});return {items,nextCursor:next(rows,query.sort)};},
  async get(headers:Headers,id:unknown){await access(headers);const row=await readContent(parse(contentIdSchema,id));if(!row)throw new ServiceError(404,"CONTENT_NOT_FOUND","内容不存在");return admin(row);},
  async create(headers:Headers,input:unknown){const actor=await access(headers,true);const value=parse(contentValueSchema,input);known(value.type);const extension=prepareContentData(types.get(value.type)?.extension,value.data);return admin(await store(()=>writeContent(actor.id,value,undefined,undefined,extension)));},
  async update(headers:Headers,id:unknown,input:unknown){const actor=await access(headers,true);const value=parse(updateContentSchema,input);known(value.value.type);const extension=prepareContentData(types.get(value.value.type)?.extension,value.value.data,true);return admin(await store(()=>writeContent(actor.id,value.value,parse(contentIdSchema,id),value.version,extension)));},
  async remove(headers:Headers,id:unknown,input:unknown){const actor=await access(headers,true);const value=parse(deleteContentSchema,input);return store(()=>deleteContent(actor.id,parse(contentIdSchema,id),value.version));},
  async listPublic(input:unknown){const query={...parse(publicContentQuerySchema,input),status:"published" as const};const rows=await readContentList(listing(query));const items=rows.slice(0,30).map(summary);return {items,nextCursor:next(rows,query.sort)};},
  async homePublic(){return (await readContentList({q:"",status:"published",sort:"priority",limit:6})).map(summary);},
  async getPublic(id:unknown):Promise<PublicContent>{const parsed=contentIdSchema.safeParse(id);const row=parsed.success?await readContent(parsed.data,true):undefined;if(!row)throw new ServiceError(404,"CONTENT_NOT_FOUND","内容不存在或未公开");return {...summary(row),body:row.body??"",data:publicContentData(types.get(row.type)?.extension,row.data,row.data_schema_version??0)};},
 };
}
