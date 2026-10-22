"use client";
import {useState} from 'react';
export function LinkImage({src,className}:{src:string;className:string}){
 const [failed,setFailed]=useState<string|null>(null);
 if(failed===src)return null;
 // eslint-disable-next-line @next/next/no-img-element
 return <img src={src} className={className} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={()=>setFailed(src)}/>;
}
