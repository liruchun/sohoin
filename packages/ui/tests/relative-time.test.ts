import assert from "node:assert/strict";
import test from "node:test";
import {relativeTime} from "../src/relative-time-format";

const now=Date.parse("2026-10-19T12:00:00+08:00");
const ago=(seconds:number)=>relativeTime(new Date(now-seconds*1000).toISOString(),now)?.label;

test("English dates preserve the original instant and Beijing time zone",()=>{
 const value=relativeTime("2026-10-19T11:59:00+08:00",now,"en")!;
 assert.equal(value.label,"1 minute ago");
 assert.equal(value.dateTime,"2026-10-19T03:59:00.000Z");
 assert.match(value.full,/11:59:00/);
 assert.match(value.full,/UTC\+08:00/);
 assert.equal(relativeTime(new Date(now+3600000).toISOString(),now,"en")?.label,"in 1 hour");
 assert.equal(relativeTime(new Date(now).toISOString(),now,"en")?.label,"just now");
});

test("relative labels switch at minute, hour, day and seven-day boundaries",()=>{
 assert.equal(ago(0),"刚刚");
 assert.equal(ago(59),"刚刚");
 assert.equal(ago(60),"1分钟前");
 assert.equal(ago(3599),"59分钟前");
 assert.equal(ago(3600),"1小时前");
 assert.equal(ago(86399),"23小时前");
 assert.equal(ago(86400),"1天前");
 assert.equal(ago(604799),"6天前");
 assert.equal(ago(604800),"10月12日");
});

test("future session expiry is never described as a past event",()=>{
 assert.equal(ago(-30),"即将");
 assert.equal(ago(-60),"1分钟后");
 assert.equal(ago(-7200),"2小时后");
 assert.equal(ago(-86400),"1天后");
 assert.equal(ago(-604800),"10月26日");
});

test("calendar dates use Beijing time and include the year when it differs",()=>{
 const newYear=Date.parse("2026-12-31T16:30:00Z");
 assert.equal(relativeTime("2026-12-20T16:30:00Z",newYear)?.label,"2026年12月21日");
 assert.equal(relativeTime("2026-01-01T00:30:00+08:00",now)?.label,"1月1日");
});

test("machine-readable timestamps and complete human dates describe the same instant",()=>{
 const value=relativeTime("2026-10-19T11:59:00+08:00",now)!;
 assert.equal(value.dateTime,"2026-10-19T03:59:00.000Z");
 assert.equal(value.label,"1分钟前");
 assert.match(value.full,/2026年10月19日/);
 assert.match(value.full,/11:59:00/);
 assert.match(value.full,/北京时间/);
 assert.equal(relativeTime("invalid",now),null);
 assert.equal(relativeTime("2026-10-19T00:00:00Z",NaN),null);
});
