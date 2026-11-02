"""A dedicated Playwright browser, owned by one worker thread."""
from concurrent.futures import Future
import json
import os
from pathlib import Path
import queue
import shutil
import threading
import uuid
from web_tools import validate_url
from agent_runtime import external_launch,clean_environment

class BrowserService:
 def __init__(self,config):
  self.config=config;self.root=config.store.root/'browser';self.root.mkdir(exist_ok=True)
  self.jobs=queue.Queue();self.lock=threading.RLock();self.latest={'running':False,'url':'','title':'','text':'','elements':[]};self.image=None;self.downloads={};self._ctx=None;self._pw=None;self._page=None;self._elements={};self._snapshot_id=''
  self.thread=threading.Thread(target=self._worker,daemon=True);self.thread.start()
 def _worker(self):
  while True:
   try:method,args,future=self.jobs.get(timeout=.15)
   except queue.Empty:
    if self._page:
     try:self._page.wait_for_timeout(30)
     except Exception:pass
    continue
   try:
    result=getattr(self,'_'+method)(**args)
    if not future.cancelled():future.set_result(result)
   except Exception as error:
    if not future.cancelled():future.set_exception(ValueError(str(error)[:1200]))
   if method=='shutdown':break
 def call(self,method,**args):
  future=Future();self.jobs.put((method,args,future))
  try:return future.result(timeout=65)
  except TimeoutError:future.cancel();raise ValueError('Browser action timed out. Retry after checking the Browser panel.') from None
 def state(self):
  with self.lock:return {**self.latest,'downloads':[dict(v) for v in self.downloads.values()]}
 def _ensure(self):
  if self._ctx and self._page and not self._page.is_closed():return
  if self._ctx:self._close()
  from playwright.sync_api import sync_playwright
  paths=[Path(os.environ.get('PROGRAMFILES','C:/Program Files'))/'Google/Chrome/Application/chrome.exe',Path(os.environ.get('PROGRAMFILES(X86)','C:/Program Files (x86)'))/'Microsoft/Edge/Application/msedge.exe',Path(os.environ.get('LOCALAPPDATA',''))/'Google/Chrome/Application/chrome.exe']
  exe=next((str(p) for p in paths if p.is_file()),None)
  if not exe and os.name=='nt':raise ValueError('Install Google Chrome or Microsoft Edge to use Beam’s browser.')
  settings=self.config.read()
  try:
   with external_launch():
    self._pw=sync_playwright().start()
    self._ctx=self._pw.chromium.launch_persistent_context(str(self.root/'profile'),executable_path=exe,headless=True if os.name!='nt' else not settings['browser_visible'],viewport={'width':1280,'height':800},accept_downloads=True,env=clean_environment(),args=['--disable-features=Translate'])
  except Exception:
   if self._pw:self._pw.stop();self._pw=None
   raise
  self._ctx.set_default_timeout(12000);self._ctx.set_default_navigation_timeout(30000)
  def route(request_route):
   url=request_route.request.url
   try:
    if url.startswith(('http://','https://')):self.config.validate(url)
    request_route.continue_()
   except Exception:request_route.abort()
  self._ctx.route('**/*',route)
  self._page=self._ctx.pages[0] if self._ctx.pages else self._ctx.new_page()
  self._ctx.on('page',self._new_page)
  self._page.on('download',self._download)
 def _new_page(self,page):self._page=page;page.on('download',self._download)
 def _download(self,download):
  ident=uuid.uuid4().hex[:12];name=Path(download.suggested_filename).name.replace(':','_').rstrip(' .')[:100] or 'download'
  folder=self.root/'downloads';folder.mkdir(exist_ok=True);path=folder/(ident+'-'+name)
  try:
   download.save_as(str(path))
   if path.stat().st_size>100_000_000:path.unlink();return
   with self.lock:self.downloads[ident]={'id':ident,'name':name,'bytes':path.stat().st_size}
  except Exception:pass
 def download_path(self,ident):
  with self.lock:item=self.downloads.get(ident)
  if not item:raise ValueError('Browser download not found')
  return self.root/'downloads'/(ident+'-'+item['name'])
 def _snapshot(self):
  self._ensure();page=self._page
  if page.url!='about:blank':self.config.validate(page.url)
  elements=[];self._elements={}
  for handle in page.query_selector_all('a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link]')[:150]:
   if not handle.is_visible():continue
   info=handle.evaluate('(e)=>({tag:e.tagName.toLowerCase(),type:e.getAttribute("type")||"",text:(e.innerText||e.getAttribute("aria-label")||e.getAttribute("placeholder")||e.getAttribute("name")||"").slice(0,180),href:e.tagName==="A"?e.href:null})')
   ident='e'+str(len(elements)+1);self._elements[ident]=handle;elements.append({'id':ident,**info})
  self._snapshot_id=uuid.uuid4().hex[:12]
  # Remove credential fields from the semantic view. Their values are never read.
  text=page.locator('body').inner_text(timeout=5000)[:25000] if page.locator('body').count() else ''
  image=page.screenshot(type='jpeg',quality=70,timeout=10000)
  result={'running':True,'url':page.url,'title':page.title(),'text':text,'elements':elements,'snapshot_id':self._snapshot_id,'note':'Untrusted page data; screenshots are for the user, not image understanding by Beam.'}
  with self.lock:self.latest=result;self.image=image
  return result
 def _open(self,url):
  self.config.validate(url);self._ensure();self._page.goto(url,wait_until='domcontentloaded');return self._snapshot()
 def _action(self,action,element_id='',snapshot_id='',text='',key=''):
  self._ensure()
  if action in ('click','fill','select'):
   if snapshot_id!=self._snapshot_id:raise ValueError('The page changed. Call browser_snapshot and use its current element IDs.')
   handle=self._elements.get(element_id)
   if not handle:raise ValueError('Element no longer exists. Read a new browser snapshot.')
   if action=='click':
    if handle.get_attribute('download') is not None:
     with self._page.expect_download(timeout=15000):handle.click()
    else:handle.click()
   elif action=='fill':
    if (handle.get_attribute('type') or '').lower()=='password':raise ValueError('Enter passwords yourself in the visible browser; the agent cannot fill them.')
    handle.fill(str(text)[:20000])
   else:handle.select_option(str(text))
  elif action=='press':
   if key not in ('Enter','Tab','Escape','ArrowDown','ArrowUp','PageDown','PageUp','Backspace'):raise ValueError('Unsupported browser key')
   self._page.keyboard.press(key)
  elif action=='back':self._page.go_back(wait_until='domcontentloaded')
  elif action=='refresh':self._page.reload(wait_until='domcontentloaded')
  else:raise ValueError('Unknown browser action')
  self._page.wait_for_timeout(150)
  return self._snapshot()
 def _restart(self):
  previous=self.latest.get('url','');self._close();self._ensure()
  if previous and previous!='about:blank':return self._open(previous)
  return self._snapshot()
 def _close(self):
  if self._ctx:self._ctx.close();self._ctx=None
  if self._pw:self._pw.stop();self._pw=None
  self._page=None;self._elements={}
  with self.lock:self.latest={'running':False,'url':'','title':'','text':'','elements':[]};self.image=None
  return {'ok':True}
 def _shutdown(self):return self._close()
 def close(self):
  if self.thread.is_alive():
   f=Future();self.jobs.put(('shutdown',{},f))
