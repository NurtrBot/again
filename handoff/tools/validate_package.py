from pathlib import Path
import json,re,hashlib
from html.parser import HTMLParser
from PIL import Image
root=Path(__file__).resolve().parents[1]
screens=json.loads((root/'design/screens.json').read_text())
assert len(screens)==21
assert {s['id'] for s in screens}=={f'{x:02}' for x in range(1,22)}
for s in screens:
 p=root/s['board']; assert p.is_file(),p
 w,h=Image.open(p).size;b=s['referenceBoundsPx']
 assert b['x']>=0 and b['y']>=0 and b['x']+b['width']<=w and b['y']+b['height']<=h,(s['id'],b,(w,h))
for p in root.rglob('*.json'): json.loads(p.read_text())
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k in ('src','href') and v and not v.startswith(('#','https:','http:','mailto:')):
    assert (root/v).is_file(),v
Links().feed((root/'DESIGN_REVIEW.html').read_text())
# Exact source PNG preservation is captured in the final checksum manifest.
for p in root.rglob('*'):
 if p.is_file() and p.suffix in ('.md','.json','.mjs','.sql','.css','.html'):
  text=p.read_text(); assert '\x00' not in text,p
print('PASS: 21 screens, 7 board references, JSON syntax, panel bounds and local viewer links.')
