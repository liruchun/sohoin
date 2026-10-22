// shadcn/ui radix-rhea NativeSelect (MIT); stays server renderable for GET filters.
import type {ComponentProps} from "react";
import {ChevronDown} from "lucide-react";
import cn from "cn/lite";
export function NativeSelect({className,size="default",...props}:Omit<ComponentProps<"select">,"size">&{size?:"default"|"sm"}){return <div data-slot="native-select-wrapper" data-size={size} className="au-native-select"><select data-slot="native-select" data-size={size} className={cn("au-input au-select",className)} {...props}/><ChevronDown data-slot="native-select-icon" aria-hidden="true"/></div>;}
export function NativeSelectOption(props:ComponentProps<"option">){return <option data-slot="native-select-option" {...props}/>;}
