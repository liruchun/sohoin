"use client";

import {createContext,useContext} from "react";
import type {WornBadge} from "@sohoin/extension-api/badges";

export type DiscussionTarget={publicId:string;type:"post"|"article"|"comment";href:string;excerpt:string;author:{name:string;avatar:string|null;publicId?:string;wornBadge?:WornBadge|null}};
export const DiscussionComposerContext=createContext<((target:DiscussionTarget,anchor:HTMLElement)=>void)|null>(null);
export function useDiscussionComposer(){return useContext(DiscussionComposerContext);}
