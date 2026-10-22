const timeZone="Asia/Shanghai";
const year=new Intl.DateTimeFormat("en-US",{year:"numeric",timeZone});
const formats=(locale:string)=>({
 relative:new Intl.RelativeTimeFormat(locale,{numeric:"always"}),
 monthDay:new Intl.DateTimeFormat(locale,{month:"long",day:"numeric",timeZone}),
 yearMonthDay:new Intl.DateTimeFormat(locale,{year:"numeric",month:"long",day:"numeric",timeZone}),
 full:new Intl.DateTimeFormat(locale,{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",timeZone}),
});
const formatters={"zh-CN":formats("zh-CN"),en:formats("en")};

/** Pure formatting: callers may supply one reference instant for a whole render. */
export function relativeTime(value:string,now:number=Date.now(),locale:string="zh-CN"){
 const english=locale==="en",{relative,monthDay,yearMonthDay,full}=formatters[english?"en":"zh-CN"];
 const date=new Date(value),timestamp=date.getTime();
 if(!Number.isFinite(timestamp)||!Number.isFinite(now))return null;
 const difference=timestamp-now,seconds=Math.abs(difference)/1000;
 let label:string;
 if(seconds<60)label=english?(difference>0?"soon":"just now"):(difference>0?"即将":"刚刚");
 else if(seconds<86400*7){
  const unit=seconds<3600?"minute":seconds<86400?"hour":"day";
  const divisor=unit==="minute"?60:unit==="hour"?3600:86400;
  label=relative.format(Math.floor(seconds/divisor)*(difference>0?1:-1),unit);
 }else label=(year.format(date)===year.format(now)?monthDay:yearMonthDay).format(date);
 return {label,dateTime:date.toISOString(),full:full.format(date)+(english?" (UTC+08:00)":"（北京时间）")};
}
