import {ExternalLink} from './external-link';
import {LinkCardContent} from './link-card';
import linkStyles from './link-card.module.css';
import {cn} from '@sohoin/ui/utils';
import {useTranslations} from "next-intl";
import type {SiteContent} from "@sohoin/core/server";
import type {CSSProperties} from "react";
import {CarouselContent,CarouselItem,CarouselPrevious,CarouselNext} from "@sohoin/ui/carousel";
import {ContentVideo} from "./content-video";
import {ContentMediaCarousel} from "./content-media-carousel";
import {ImageLightbox} from "@sohoin/ui/image-lightbox";
import styles from "./content-media.module.css";

export function ContentMedia({media,detail=false,priority=false}:{media:SiteContent["media"];detail?:boolean;priority?:boolean}){
 const t=useTranslations("Web");
 if(!media.length)return null;
 const single=media.length===1;
 const lightboxImages=media.filter(item=>item.kind!=='link').map(image=>({src:image.url,alt:image.alt,width:image.width,height:image.height,kind:image.kind,poster:image.poster}));
 const ratio=(image:SiteContent["media"][number])=>image.kind==='link'?1.15:image.width/image.height<13/30?0.3:image.width/image.height;
 const imageStyle=(image:SiteContent["media"][number])=>({"--media-ratio":ratio(image)}) as CSSProperties;
 const images=media.map((image,index)=>{
  if(image.kind==='link')return <ExternalLink key={image.url} href={image.url} hostname={new URL(image.url).hostname} className={cn(linkStyles.card,linkStyles.published)}><LinkCardContent expandTitle url={image.url} title={image.alt} image={image.image} icon={image.icon}/></ExternalLink>;
  if(image.kind==='video')return <ContentVideo key={image.url} src={image.url} poster={image.poster} width={image.width} height={image.height} hasAudio={image.hasAudio} lightboxIndex={lightboxImages.findIndex(item=>item.src===image.url)} label={image.alt||t('postVideo')}/>;
  const lightboxIndex=lightboxImages.findIndex(item=>item.src===image.url);
  const sources=image.sources?.length?[...image.sources.map(source=>`${image.url}?variant=${source.variant} ${source.width}w`),`${image.url} ${image.width}w`].join(", "):undefined;
  const preview=image.sources?.[0];
  const sizes=single
   ? (detail?"(max-width: 45rem) calc(100vw - 2rem), 40rem":"(max-width: 30rem) calc(100vw - 6.5rem), (max-width: 40.625rem) calc(100vw - 6.5rem), (max-width: 44.75rem) calc(100vw - 7.5rem), 37.25rem")
   : `(min-width: 45rem) ${Math.min(12.5,Math.max(9.375,12.5/ratio(media[0])))*5/6*ratio(image)}rem, ${11.25*5/6*ratio(image)}rem`;
  return <a key={image.url} href={image.url} target="_blank" rel="noreferrer" draggable={false} className={styles.imageLink}
   data-lightbox-index={lightboxIndex} data-carousel-index={index} data-long-image={image.width/image.height<13/30} data-skeleton-part="block" aria-label={image.alt||t("openImage",{number:index+1})}>
   {/* Responsive previews retain the original as the largest candidate and fallback. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={preview?`${image.url}?variant=${preview.variant}`:image.url} srcSet={sources} sizes={sources?`${priority&&index===0?"":"auto, "}${sizes}`:undefined}
    width={image.width} height={image.height} alt={image.alt} draggable={false} loading={priority&&index===0?"eager":"lazy"} decoding="async"/>
   {image.width/image.height<13/30&&<span className={styles.longImage} aria-hidden="true">{t("longImage")}</span>}
  </a>;
 });
 if(single&&media[0].kind==='link')return <div className={styles.frame} data-detail={detail}><div className={styles.linkSingle} style={{"--media-first-ratio":ratio(media[0]),"--media-ratio":ratio(media[0])} as CSSProperties}>{images[0]}</div></div>;
 if(single&&media[0].kind==='video')return <ImageLightbox images={lightboxImages} className={styles.frame} data-detail={detail}>{images[0]}</ImageLightbox>;
 if(single)return <ImageLightbox images={lightboxImages} className={styles.frame} data-detail={detail}><div className={styles.single} style={imageStyle(media[0])}>{images[0]}</div></ImageLightbox>;
 return <ImageLightbox images={lightboxImages} className={styles.frame} data-detail={detail}>
  <ContentMediaCarousel adaptive className={styles.gallery} style={{"--media-first-ratio":ratio(media[0])} as CSSProperties} aria-label={t("postMedia",{count:media.length})}>
   <CarouselContent className={styles.track} viewportClassName={styles.viewport}>
    {images.map((image,index)=><CarouselItem key={media[index].url} className={styles.slide} style={imageStyle(media[index])} aria-label={t("mediaPosition",{number:index+1,count:media.length})}>{image}</CarouselItem>)}
   </CarouselContent>
    <CarouselPrevious magnetic magneticAreaSelector="article" className={styles.previous} aria-label={t("previousMedia")}/>
    <CarouselNext magnetic magneticAreaSelector="article" className={styles.next} aria-label={t("nextMedia")}/>
  </ContentMediaCarousel>
 </ImageLightbox>;
}
