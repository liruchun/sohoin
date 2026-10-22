import styles from "./static-icon.module.css";
import {cn} from "@sohoin/ui/utils";

type IconName="heart"|"face-slightly-smiling"|"message-circle"|"bookmark"|"ellipsis"|"chevron-right";
/** Decorative only: the owning control or text supplies the accessible name. */
export function StaticIcon({name,className,size="1.5rem"}:{name:IconName;className?:string;size?:string}){
 return <svg width={size} height={size} className={cn(styles.root,className)} aria-hidden="true" focusable="false"><use href={`/icons/lucide-static.6d04cab6d375.svg#${name}`}/></svg>;
}
