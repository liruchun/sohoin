// shadcn/ui radix-rhea Table (MIT). No client boundary: static rows remain server-rendered.
import type {ComponentProps} from "react";
import cn from "cn/lite";
export function Table({className,...props}:ComponentProps<"table">){return <div data-slot="table-container" className="au-table-scroll"><table data-slot="table" className={cn("au-table",className)} {...props}/></div>;}
export function TableHeader(props:ComponentProps<"thead">){return <thead data-slot="table-header" {...props}/>;}
export function TableBody(props:ComponentProps<"tbody">){return <tbody data-slot="table-body" {...props}/>;}
export function TableRow(props:ComponentProps<"tr">){return <tr data-slot="table-row" {...props}/>;}
export function TableHead({scope="col",...props}:ComponentProps<"th">){return <th data-slot="table-head" scope={scope} {...props}/>;}
export function TableCell(props:ComponentProps<"td">){return <td data-slot="table-cell" {...props}/>;}
export function TableCaption(props:ComponentProps<"caption">){return <caption data-slot="table-caption" {...props}/>;}
