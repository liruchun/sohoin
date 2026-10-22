"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";

type ProfileHeading={publicId:string;name:string};
const Context=createContext<{profile:ProfileHeading|null;setProfile:(profile:ProfileHeading)=>void}|null>(null);
export function ProfileHeaderProvider({children}:{children:ReactNode}){
 const [profile,setProfile]=useState<ProfileHeading|null>(null);
 return <Context.Provider value={{profile,setProfile}}>{children}</Context.Provider>;
}
export function useProfileHeader(){return useContext(Context)?.profile;}
export function ProfileHeaderRegistration({publicId,name}:ProfileHeading){
 const setProfile=useContext(Context)?.setProfile;
 useEffect(()=>{setProfile?.({publicId,name});},[setProfile,publicId,name]);
 return null;
}
