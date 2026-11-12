
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(executable_path="/usr/bin/chromium",args=["--no-sandbox"])
 page=b.new_page(viewport={"width":1280,"height":1000})
 page.set_content((ROOT/"evidence"/"initial_v1.html").read_text(encoding="utf-8"))
 page.click("#start")
 page.screenshot(path=str(ROOT/"evidence"/"initial_desktop.png"),full_page=True)
 # Determine the displayed answer from the real CSS color rather than changing game state.
 def correct_id():
  return page.evaluate("COLORS.find(c=>c.id===answer).id")
 before=int(page.inner_text("#score"))
 page.evaluate("""()=>{const k=String(COLORS.findIndex(c=>c.id===answer)+1);document.dispatchEvent(new KeyboardEvent('keydown',{key:k,repeat:true,bubbles:true}));}""")
 repeat_after=int(page.inner_text("#score"))
 page.click("#start")
 page.evaluate("""()=>{for(let i=0;i<2;i++){document.querySelector('[data-color="'+answer+'"]').click();}}""")
 rapid_score=int(page.inner_text("#score"))
 page.set_viewport_size({"width":390,"height":844})
 widths=page.evaluate("({scroll:document.documentElement.scrollWidth,viewport:innerWidth})")
 page.screenshot(path=str(ROOT/"evidence"/"initial_mobile.png"),full_page=True)
 result={"key_repeat":{"expected_score_delta":0,"actual_score_delta":repeat_after-before},"rapid_two_clicks":{"expected_score":1,"actual_score":rapid_score},"mobile_width":widths}
 (ROOT/"evidence"/"initial_findings.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
 print(json.dumps(result,ensure_ascii=False))
 b.close()
