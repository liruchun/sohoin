import {cn} from '@sohoin/ui/utils';
import layout from './profile-editor.module.css';
import media from '../../../../_features/media/media-picker.module.css';
import styles from './profile-editor-skeleton.module.css';

function Block({className,part='block'}:{className:string;part?:string}){return <span className={cn(styles.block,className)} data-skeleton-part={part} data-skeleton-placeholder=""/>;}
function Label(){return <div className={styles.labelRow}><Block className={styles.label} part="name"/></div>;}

export function ProfileEditorSkeleton(){
 return <section className={cn(layout.panel,styles.skeleton)} aria-hidden="true" data-skeleton-item="">
  <div className={cn(layout.title,styles.titleRow)}><Block className={styles.title} part="title"/></div>
  <div className={layout.form}>
   <div className={layout.field}><Label/><div className={media.imagePicker}><Block className={styles.avatar}/><div className={media.imageActions}><Block className={styles.button}/><Block className={styles.hint} part="body"/></div></div></div>
   <div className={layout.field}><Label/><Block className={styles.input}/></div>
   <div className={layout.field}><Label/><Block className={styles.bio}/></div>
   <div className={layout.field}><Label/><Block className={styles.input}/></div>
   <div className={layout.contactField}>
    <div className={layout.contactHeading}><Label/><Block className={styles.select}/></div>
    <div className={layout.contacts}>{Array.from({length:9},(_,i)=><Block key={i} className={cn(styles.contact,layout.contact)}/>)}</div>
   </div>
   <div className={layout.actions}><Block className={styles.button} part="action"/><Block className={styles.button} part="action"/></div>
  </div>
 </section>;
}
