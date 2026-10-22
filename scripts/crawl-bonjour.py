"""Read-only public Bonjour sample crawler; no login, mutation or private endpoints."""
import argparse, datetime, hashlib, html, json, re, time, urllib.request, urllib.error
from pathlib import Path
from html.parser import HTMLParser
BASE="https://bonjour.bio"
class Scripts(HTMLParser):
    def __init__(self): super().__init__(); self.active=False; self.rows=[]
    def handle_starttag(self,tag,attrs):
        if tag=="script": self.active=True
    def handle_endtag(self,tag):
        if tag=="script": self.active=False
    def handle_data(self,data):
        if self.active: self.rows.append(data)
def models(document):
    parser=Scripts(); parser.feed(document); stream=""
    for row in parser.rows:
        match=re.fullmatch(r"self\.__next_f\.push\((.*)\)",row,re.S)
        if match:
            try:
                value=json.loads(match[1])
                if len(value)>1 and isinstance(value[1],str):stream+=value[1]
            except (ValueError,TypeError):pass
    data=stream.encode(); pos=0; records={}
    while pos<len(data):
        while pos<len(data) and data[pos:pos+1]==b"\n":pos+=1
        colon=data.find(b":",pos)
        if colon<0:break
        key=data[pos:colon].decode(); pos=colon+1
        if data[pos:pos+1]==b"T":
            comma=data.index(b",",pos); size=int(data[pos+1:comma],16); records[key]=data[comma+1:comma+1+size].decode();pos=comma+1+size
        else:
            end=data.find(b"\n",pos)
            if end<0:end=len(data)
            try: records[key]=json.loads(data[pos:end])
            except ValueError:pass
            pos=end+1
    def resolve(value,seen=()):
        if value=="$undefined":return None
        if isinstance(value,str) and re.fullmatch(r"\$[0-9a-f]+",value) and value[1:] in records and value[1:] not in seen:return resolve(records[value[1:]],seen+(value[1:],))
        if isinstance(value,list):return [resolve(v,seen) for v in value]
        if isinstance(value,dict):return {k:resolve(v,seen) for k,v in value.items()}
        return value
    return [resolve(v) for v in records.values()]
def find(value,key):
    if isinstance(value,dict):
        if key in value:yield value[key]
        for child in value.values():yield from find(child,key)
    elif isinstance(value,list):
        for child in value:yield from find(child,key)
def text(value):return html.unescape(value or "").replace("\x00","")
def safe_profile(p,slug):
    links=[]
    for grid in p.get("gridItems",[]) or []:
        content=grid.get("content",{}); social=content.get("social",{})
        link=(social.get("detail") or {}).get("linkContent")
        if isinstance(link,str) and link.startswith("https://"):links.append(link[:500])
    basic=p.get("basicInfo") or {}
    return {"id":slug,"name":text(p.get("name"))[:120],"bio":text(p.get("description")),"avatar":p.get("avatar") if str(p.get("avatar","")).startswith("https://") else None,"homepage":BASE+"/"+slug,"links":list(dict.fromkeys(links))[:12],"role":text(basic.get("role"))[:500] if isinstance(basic.get("role"),str) else ""}
def run(directory):
    root=Path(directory); cache=root/"cache";cache.mkdir(parents=True,exist_ok=True);errors=[];requests=0
    def fetch(path,is_json=True):
        nonlocal requests
        if not path.startswith("/") or path.startswith("//"):raise ValueError("Only source-site public paths allowed")
        name=hashlib.sha256(path.encode()).hexdigest()+(".json" if is_json else ".html"); file=cache/name
        if file.exists():raw=file.read_bytes()
        else:
            time.sleep(.2)
            request=urllib.request.Request(BASE+path,headers={"User-Agent":"sohoin-Demo-Import/1.0 (public-read-only)","Accept":"application/json" if is_json else "text/html"})
            with urllib.request.urlopen(request,timeout=30) as response:
                if urllib.parse.urlparse(response.url).hostname!="bonjour.bio":raise ValueError("Unexpected redirect")
                raw=response.read(12*1024*1024+1)
                if len(raw)>12*1024*1024:raise ValueError("Oversize response")
            file.write_bytes(raw);requests+=1
        return json.loads(raw) if is_json else raw.decode("utf-8")
    home=models(fetch("/?feed=featured",False));pages=list(find(home,"initialPage"));initial=next(p for p in pages if isinstance(p,dict) and "entries" in p)
    selected=[e["post"] for e in initial["entries"] if "post" in e][:20]
    if len(selected)!=20:raise ValueError("Expected 20 public featured posts")
    users={};posts=[];comments={};types=fetch("/api/aio/api/v1/community/reaction-types")["data"]
    def profile(item):
        p=item.get("profile") or {};slug=item.get("profile_link") or p.get("profile_link")
        if not isinstance(slug,str) or not re.fullmatch("[a-zA-Z0-9_-]{1,80}",slug):raise ValueError("Missing public author")
        if slug not in users:users[slug]=safe_profile(p,slug)
        return slug
    def normalize(item):
        media=[u for u in item.get("images",[]) if isinstance(u,str) and u.startswith("https://")]
        return {"id":item["_id"],"author":profile(item),"body":text(item.get("content")),"createdAt":item.get("create_time"),"updatedAt":item.get("update_time"),"reactions":[{"code":r["key"],"count":r["count"]} for r in item.get("reactions",[]) if r.get("count",0)>0],"media":media,"imageMetadata":item.get("image_metadata") or [],"link":item.get("link") if isinstance(item.get("link"),str) else None,"stats":item.get("stats") or {}}
    for picked in selected:
        pid=picked["_id"]; raw=fetch("/api/aio/api/v1/community/items/post/"+pid)["data"];post=normalize(raw);post["categories"]=picked.get("category") or [];post["tags"]=picked.get("tags") or [];posts.append(post)
        queue=[("post",pid)];seen=set()
        while queue:
            kind,oid=queue.pop(0)
            if (kind,oid) in seen:continue
            seen.add((kind,oid));items=fetch(f"/api/aio/api/v1/community/items/{kind}/{oid}/replies?projection=discussion")["data"]
            if not isinstance(items,list):raise ValueError("Unexpected replies response")
            for item in items:
                cid=item["_id"];parent=item.get("parent") or {};parentid=parent.get("id") if parent.get("resource_type")=="comment" else None
                comment=normalize(item);comment.update(postId=pid,parentId=parentid);comments[cid]=comment
                if int((item.get("stats") or {}).get("reply_count",0))>0:queue.append(("comment",cid))
            if len(comments)>3000:raise ValueError("Comment safety bound reached")
        print("post",len(posts),"/20; comments",sum(c["postId"]==pid for c in comments.values()),"reported",raw.get("stats",{}).get("reply_count"),flush=True)
    for i,(slug,card) in enumerate(list(users.items())):
        try:
            page=models(fetch("/"+slug,False));candidates=list(find(page,"profile"));p=next(p for p in candidates if isinstance(p,dict) and p.get("profile_link")==slug and "_id" in p)
            users[slug]=safe_profile(p,slug)
        except (urllib.error.HTTPError,StopIteration) as error:errors.append({"profile":slug,"error":str(error)[:150]})
        if (i+1)%20==0:print("profiles",i+1,"/",len(users),flush=True)
    dataset={"source":BASE+"/?feed=featured","capturedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"posts":posts,"comments":list(comments.values()),"users":list(users.values()),"reactionTypes":types,"warnings":errors,"requests":requests}
    (root/"dataset.json").write_text(json.dumps(dataset,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"posts":len(posts),"comments":len(comments),"users":len(users),"warnings":len(errors),"requests":requests}),flush=True)
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("directory");run(parser.parse_args().directory)
