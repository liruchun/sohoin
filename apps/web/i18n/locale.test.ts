import assert from "node:assert/strict";
import test from "node:test";
import {preferredLocale} from "./locale";
import chinese from "./messages/zh-CN.json";
import english from "./messages/en.json";

test("an explicit supported preference wins over browser language",()=>{
 assert.equal(preferredLocale("zh-CN","en-US,en;q=0.9"),"zh-CN");
 assert.equal(preferredLocale("en","zh-CN"),"en");
});

test("language negotiation respects quality, regional tags and excluded languages",()=>{
 assert.equal(preferredLocale(undefined,"en-US;q=0.4,zh-TW;q=0.9"),"zh-CN");
 assert.equal(preferredLocale(undefined,"fr-FR, en-GB;q=0.8, zh;q=0.5"),"en");
 assert.equal(preferredLocale(undefined,"en;q=0,zh;q=0.5"),"zh-CN");
 assert.equal(preferredLocale(undefined,"EN-us; q=0.9"),"en");
});

test("untrusted preferences cannot select arbitrary message files",()=>{
 assert.equal(preferredLocale("../../private","en-US"),"en");
 assert.equal(preferredLocale("fr",null),"zh-CN");
 assert.equal(preferredLocale(undefined,"en;q=invalid,zh;q=0.8"),"zh-CN");
 assert.equal(preferredLocale(undefined,"en;q=2"),"zh-CN");
});

test("both interface catalogs cover the same messages",()=>{
 assert.deepEqual(Object.keys(english).sort(),Object.keys(chinese).sort());
 for(const namespace of ["Web","UI"] as const){
  assert.deepEqual(Object.keys(english[namespace]).sort(),Object.keys(chinese[namespace]).sort());
  for(const value of Object.values(english[namespace]))assert.ok(value.trim());
 }
});
