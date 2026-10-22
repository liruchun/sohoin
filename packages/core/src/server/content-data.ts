import "server-only";
import {contentDataSchema,type ContentData,type ContentFieldDefinition,type ContentExtensionDefinition} from "@sohoin/extension-api/content";
import {ServiceError} from "./security";
function valid(value:unknown,field:ContentFieldDefinition){
 switch(field.kind){
  case "text":return typeof value==="string"&&value.length<=field.maxLength&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
  case "boolean":return typeof value==="boolean";
  case "enum":return typeof value==="string"&&field.options.includes(value);
  case "number":return typeof value==="number"&&Number.isFinite(value)&&(!field.integer||Number.isInteger(value))&&(field.min===undefined||value>=field.min)&&(field.max===undefined||value<=field.max);
 }
}
export function checkExtensionDefinition(definition?:ContentExtensionDefinition){
 if(!definition)return;
 if(!Number.isInteger(definition.schemaVersion)||definition.schemaVersion<1||definition.schemaVersion>32767||Object.keys(definition.fields).length>20)throw new Error("Invalid content extension definition");
 for(const [key,field] of Object.entries(definition.fields)){
  if(!contentDataSchema.safeParse({[key]:true}).success)throw new Error("Invalid extension field key");
  if((field.public!==undefined&&typeof field.public!=="boolean")||(field.required!==undefined&&typeof field.required!=="boolean"))throw new Error("Invalid extension field flags");
  if(field.kind==="text"&&(!Number.isInteger(field.maxLength)||field.maxLength<1||field.maxLength>2000))throw new Error("Invalid extension text limit");
  if(field.kind==="number"&&((field.min!==undefined&&!Number.isFinite(field.min))||(field.max!==undefined&&!Number.isFinite(field.max))||(field.min!==undefined&&field.max!==undefined&&field.min>field.max)))throw new Error("Invalid extension number range");
  if(field.kind==="enum"&&(!field.options.length||field.options.length>30||new Set(field.options).size!==field.options.length||field.options.some(value=>typeof value!=="string"||value.length>2000)))throw new Error("Invalid extension enum");
  if(!["text","number","boolean","enum"].includes(field.kind))throw new Error("Unknown extension field type");
 }
}
export function prepareContentData(definition:ContentExtensionDefinition|undefined,input:ContentData|undefined,update=false){
 const data=input??{};
 if(Buffer.byteLength(JSON.stringify(data),"utf8")>8192)throw new ServiceError(400,"CONTENT_DATA_TOO_LARGE","扩展数据最多 8 KiB");
 if(!definition){if(Object.keys(data).length)throw new ServiceError(400,"UNKNOWN_CONTENT_DATA","此类型未声明扩展字段");return undefined;}
 if(update&&input===undefined)throw new ServiceError(400,"CONTENT_DATA_REQUIRED","请提交此类型的完整扩展字段，避免覆盖已有数据");
 for(const key of Object.keys(data))if(!Object.hasOwn(definition.fields,key))throw new ServiceError(400,"UNKNOWN_CONTENT_DATA","包含未声明的扩展字段");
 for(const [key,field] of Object.entries(definition.fields)){
  if(!Object.hasOwn(data,key)){if(field.required)throw new ServiceError(400,"INVALID_CONTENT_DATA","缺少必填扩展字段："+key);continue;}
  if(!valid(data[key],field))throw new ServiceError(400,"INVALID_CONTENT_DATA","扩展字段格式无效："+key);
 }
 return {schemaVersion:definition.schemaVersion,data};
}
export function publicContentData(definition:ContentExtensionDefinition|undefined,data:ContentData|undefined,storedVersion?:number):ContentData{
 if(definition&&storedVersion!==undefined&&storedVersion!==definition.schemaVersion)return {};
 return Object.fromEntries(Object.entries(definition?.fields??{}).filter(([key,field])=>field.public===true&&data&&Object.hasOwn(data,key)&&valid(data[key],field)).map(([key])=>[key,data![key]]));
}
