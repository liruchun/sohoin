import "server-only";
import {DOMParser,XMLSerializer,type Element,type Node} from "@xmldom/xmldom";
import {ServiceError} from "./security";

const namespace="http://www.w3.org/2000/svg";
const inkscapeNamespace="http://www.inkscape.org/namespaces/inkscape";
const sodipodiNamespace="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd";
const editorNamespaces=new Set([inkscapeNamespace,sodipodiNamespace]);
const elements=new Set("svg g defs path rect circle ellipse line polyline polygon title desc linearGradient radialGradient stop clipPath mask pattern symbol use style text tspan textPath filter feGaussianBlur feOffset feBlend feColorMatrix feComposite feFlood feMerge feMergeNode".split(" "));
const attributes=new Set("id class x y x1 y1 x2 y2 cx cy r rx ry d points width height viewBox preserveAspectRatio transform fill fill-opacity fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-dasharray stroke-dashoffset opacity color color-interpolation color-interpolation-filters clip-path clip-rule clipPathUnits mask maskUnits maskContentUnits patternUnits patternContentUnits patternTransform gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity href style version role focusable font-family font-size font-weight font-style text-anchor dominant-baseline vector-effect paint-order dx dy rotate textLength lengthAdjust startOffset filter filterUnits primitiveUnits in in2 result stdDeviation mode type values operator k1 k2 k3 k4 flood-color flood-opacity".split(" "));
const properties=new Set("fill fill-opacity fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-dasharray stroke-dashoffset opacity color color-scheme clip-path clip-rule mask filter display visibility stop-color stop-opacity font-family font-size font-weight font-style text-anchor dominant-baseline vector-effect paint-order".split(" "));
const invalid=()=>new ServiceError(415,"UNSUPPORTED_LOGO_SVG","SVG 含有不支持的元素、脚本、外部资源或样式，请导出独立的静态 SVG");

function references(value:string){
 if(/[\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||/\/\*|@|expression\s*\(/i.test(value))throw invalid();
 for(const match of value.matchAll(/url\s*\(\s*([\s\S]*?)\s*\)/gi))if(!/^(?:#[\w.:-]+|"#[\w.:-]+"|'#[\w.:-]+')$/.test(match[1]))throw invalid();
}
function declarations(css:string){
 const output=[];
 for(const part of css.split(";")){
  if(!part.trim())continue;
  const at=part.indexOf(":");if(at<1)throw invalid();
  const property=part.slice(0,at).trim(),value=part.slice(at+1).trim();
  // Inkscape keeps this editor-only font annotation even after text becomes paths.
  // Discard it rather than extending the emitted SVG presentation allowlist.
  if(property==="-inkscape-font-specification"){
   if(!value||/[{}<>]/.test(value))throw invalid();
   references(value);continue;
  }
  if((!properties.has(property)&&!/^--[a-zA-Z][\w-]{0,60}$/.test(property))||!value||/[{}<>]/.test(value))throw invalid();
  references(value);output.push(property+":"+value);
 }
 return output.join(";");
}
/** Deliberately limited CSS grammar: presentation declarations and color-scheme media rules. */
function stylesheet(css:string,media=true):string{
 if(/[\\<>\u0000]/.test(css)||/\/\*/.test(css))throw invalid();
 let cursor=0,output="";
 while(cursor<css.length){
  if(/\s/.test(css[cursor])){cursor++;continue;}
  const open=css.indexOf("{",cursor);if(open<0)throw invalid();
  const selector=css.slice(cursor,open).trim();let depth=1,end=open+1;
  for(;end<css.length&&depth;end++){if(css[end]==="{")depth++;else if(css[end]==="}")depth--;}
  if(depth)throw invalid();
  const body=css.slice(open+1,end-1);
  if(selector.startsWith("@")){
   if(!media||!/^@media\s*\(\s*prefers-color-scheme\s*:\s*(?:dark|light)\s*\)$/.test(selector))throw invalid();
   output+=selector+"{"+stylesheet(body,false)+"}";
  }else{
   if(!selector||!/^[\w.#,:*\s>+~-]+$/.test(selector)||/[{}]/.test(body))throw invalid();
   output+=selector+"{"+declarations(body)+"}";
  }
  cursor=end;
 }
 return output;
}

/** Parse and validate a bounded static SVG document; never inline uploaded XML into HTML. */
export function sanitizeLogoSvg(bytes:Uint8Array){
 if(bytes.length>1024*1024)throw new ServiceError(413,"SVG_TOO_LARGE","SVG 请控制在 1 MiB 以内");
 let text:string;
 try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{throw invalid();}
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw invalid();
 let document;
 try{document=new DOMParser({onError:()=>{throw invalid();}}).parseFromString(text,"image/svg+xml");}catch{throw invalid();}
 const root=document.documentElement;
 if(!root||root.localName!=="svg"||root.namespaceURI!==namespace)throw invalid();
 let nodes=0;
 function visit(node:Node,depth:number){
  if(++nodes>10000||depth>64)throw invalid();
  if(node.nodeType===1){
   const element=node as Element;
   if(element.namespaceURI!==namespace||!elements.has(element.localName??"")||element.attributes.length>128)throw invalid();
   for(let i=0;i<element.attributes.length;i++){
    const attr=element.attributes.item(i)!;
    if(attr.value.length>262144)throw invalid();
    if(attr.name==="xmlns"||attr.prefix==="xmlns"){
     if(editorNamespaces.has(attr.value)){element.removeAttributeNode(attr);i--;continue;}
     if(![namespace,"http://www.w3.org/1999/xlink"].includes(attr.value))throw invalid();
     continue;
    }
    const name=attr.localName??attr.name;
    // Editor annotations are discarded, never admitted as SVG presentation attributes.
    if(attr.namespaceURI&&editorNamespaces.has(attr.namespaceURI)){element.removeAttributeNode(attr);i--;continue;}
    if(attr.namespaceURI==="http://www.w3.org/XML/1998/namespace"&&["space","lang"].includes(name)){if(!/^[\w -]{1,40}$/.test(attr.value))throw invalid();continue;}
    if(attr.namespaceURI&&!(attr.namespaceURI==="http://www.w3.org/1999/xlink"&&name==="href"))throw invalid();
    if(!attributes.has(name)&&!/^aria-[a-z-]+$/.test(name))throw invalid();
    if(name==="style")element.setAttribute(attr.name,declarations(attr.value));
    else if(name==="href"){if(!/^#[\w.:-]+$/.test(attr.value))throw invalid();}
    else references(attr.value);
   }
   if(element.localName==="style"){
    for(let child=element.firstChild;child;child=child.nextSibling)if(child.nodeType!==3&&child.nodeType!==4)throw invalid();
    element.textContent=stylesheet(element.textContent??"");
   }
  }else if(node.nodeType!==3&&node.nodeType!==4)throw invalid();
  for(let child=node.firstChild;child;){
   const next=child.nextSibling;
   const editorView=child.nodeType===1&&(child as Element).namespaceURI===sodipodiNamespace&&(child as Element).localName==="namedview";
   if(child.nodeType===8||editorView)node.removeChild(child);else visit(child,depth+1);
   child=next;
  }
 }
 visit(root,0);
 // Serializing only the root discards XML declarations and non-rendered document metadata.
 return Buffer.from(new XMLSerializer().serializeToString(root));
}
