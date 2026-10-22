// shadcn/ui radix-rhea Card (MIT). The fieldset option preserves existing form semantics.
import type {ComponentProps} from "react";
import cn from "cn/lite";
type CardProps=(({as:"fieldset"}&ComponentProps<"fieldset">)|({as?:"div"}&ComponentProps<"div">))&{size?:"default"|"sm"};
export function Card(props:CardProps){
 if(props.as==="fieldset"){const {as,className,size="default",...rest}=props;return <fieldset data-slot="card" data-size={size} className={cn("au-card",className)} {...rest}/>;}
 const {as,className,size="default",...rest}=props;return <div data-slot="card" data-size={size} className={cn("au-card",className)} {...rest}/>;
}
export function CardHeader({className,...props}:ComponentProps<"div">){return <div data-slot="card-header" className={cn("au-card-header",className)} {...props}/>;}
export function CardTitle({className,...props}:ComponentProps<"h2">){return <h2 data-slot="card-title" className={cn("au-card-title",className)} {...props}/>;}
export function CardDescription({className,...props}:ComponentProps<"p">){return <p data-slot="card-description" className={cn("au-muted",className)} {...props}/>;}
export function CardContent({className,...props}:ComponentProps<"div">){return <div data-slot="card-content" className={cn("au-card-content",className)} {...props}/>;}
export function CardFooter({className,...props}:ComponentProps<"div">){return <div data-slot="card-footer" className={cn("au-card-footer",className)} {...props}/>;}
export function CardAction({className,...props}:ComponentProps<"div">){return <div data-slot="card-action" className={cn("au-card-action",className)} {...props}/>;}
