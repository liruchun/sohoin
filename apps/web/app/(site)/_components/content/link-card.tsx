import {LinkImage} from './link-image';
import {Globe} from 'lucide-react';
import styles from './link-card.module.css';

/** Plain content can be rendered on the server or inside an editor button. */
export function LinkCardContent({url,title,image,icon,expandTitle=false}:{url:string;title:string;image?:string;icon?:string;expandTitle?:boolean}){
 // Asset names and the site's declared icon are useful signals; dimensions alone
 // cannot distinguish a small photograph from a logo. Unknown covers stay clear.
 const branded=!!image&&(image===icon||/(?:^|[\/_.?=&-])(?:favicon|logo|apple-touch-icon)(?:[\/_.?=&-]|$)|\.ico(?:[?#]|$)/i.test(image));
 return <>
  <span className={styles.visual}>
   {!branded&&<Globe className={styles.fallback} aria-hidden="true"/>}
   {image&&<LinkImage className={branded?styles.brandBackdrop:styles.cover} src={image}/>}
  </span>
  <span className={styles.caption}>
   <span className={styles.heading}>
    <strong className={styles.title} aria-hidden={expandTitle||undefined}>{title}</strong>
    {expandTitle&&<strong className={styles.expandedTitle}>{title}</strong>}
    {!expandTitle&&icon&&<LinkImage className={styles.icon} src={icon}/>}
   </span>
   <span className={styles.site}>
    <span>{new URL(url).hostname}</span>
    {expandTitle&&icon&&<LinkImage className={styles.icon} src={icon}/>}
   </span>
  </span>
 </>;
}
