
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parent
rows=[]; errors=[]
def rec(id,case,expected,actual,ok):
 rows.append(dict(id=id,case=case,expected=expected,actual=actual,passed=bool(ok)))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path="/usr/bin/chromium",args=["--no-sandbox"])
 page=None
 def load(width=1280,touch=False):
  global page
  if page:page.close()
  page=browser.new_page(viewport={"width":width,"height":900 if width>780 else 844},has_touch=touch)
  page.on("pageerror",lambda e:errors.append(str(e)))
  page.clock.install()
  page.set_content((ROOT/"index.html").read_text(encoding="utf-8"))
 def txt(s):return page.inner_text(s)
 def state():return page.get_attribute("#stage","data-state")
 def score():return int(txt("#score"))
 def lives():return int(txt("#lives"))
 def current():
  return page.evaluate("""()=>{const hex=document.querySelector("#word").style.color;
  const colors=[["red","rgb(190, 48, 69)"],["blue","rgb(39, 96, 194)"],["green","rgb(22, 128, 87)"],["purple","rgb(123, 67, 185)"]];
  return colors.find(x=>x[1]===hex)[0];}""")
 def pick(correct=True,via="click"):
  color=current()
  if not correct:color=next(x for x in ["red","blue","green","purple"] if x!=color)
  if via=="key":page.keyboard.press(str(["red","blue","green","purple"].index(color)+1))
  elif via=="touch":page.locator(f'[data-color="{color}"]').tap()
  else:page.locator(f'[data-color="{color}"]').click()
 def step(ms=200):page.clock.run_for(ms)
 load()
 rec("G01","초기 화면","준비·0점·생명3·40초",f"{state()}/{score()}/{lives()}/{txt('#time')}",state()=="ready" and score()==0 and lives()==3 and txt("#time")=="40.0초")
 page.keyboard.press("1")
 rec("G02","시작 전 키 입력","점수·생명 불변",f"{score()}/{lives()}",score()==0 and lives()==3)
 page.click("#start")
 rec("G03","시작 버튼","진행 상태·선택 버튼 활성",state(),state()=="running" and page.locator(".choice:enabled").count()==4)
 label=txt("#word");colors={"red":"빨강","blue":"파랑","green":"초록","purple":"보라"}
 rec("G04","글자 의미와 색","항상 서로 다름",label+"/"+colors[current()],label!=colors[current()])
 pick()
 rec("G05","정답 클릭","점수1·생명3",f"{score()}/{lives()}",score()==1 and lives()==3)
 # Synchronous burst avoids Playwright's action waiting while testing the 180ms lock.
 page.evaluate("""()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"1",bubbles:true}))""")
 rec("G06","잠금 중 추가 입력","점수1·생명3 유지",f"{score()}/{lives()}",score()==1 and lives()==3)
 step();pick(False)
 rec("G07","오답 클릭","생명2·점수1",f"{lives()}/{score()}",lives()==2 and score()==1)
 step()
 before=(score(),lives())
 page.evaluate("""()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"1",repeat:true,bubbles:true}))""")
 rec("G08","키 길게 누름 repeat","점수·생명 불변",f"{score()}/{lives()}",(score(),lives())==before)
 pick(True,"key")
 rec("G09","숫자키 정답","점수2",str(score()),score()==2)
 step();before=(score(),lives());page.keyboard.press("9")
 rec("G10","무관한 키 입력","점수·생명 불변",f"{score()}/{lives()}",(score(),lives())==before)
 page.click("#pause")
 frozen=txt("#time");step(5000)
 rec("G11","일시정지 5초","시간 고정·일시정지",txt("#time")+"/"+state(),txt("#time")==frozen and state()=="paused")
 page.keyboard.press("1")
 rec("G12","정지 중 응답","점수·생명 불변",f"{score()}/{lives()}",(score(),lives())==before)
 page.keyboard.press("p");step(1000)
 rec("G13","P키 계속하기","진행 복귀·시간 감소",state()+"/"+txt("#time"),state()=="running" and txt("#time")!=frozen)
 # Start a fresh round using only the visible restart control.
 page.click("#start")
 rec("G14","진행 중 처음부터 다시","점수0·생명3·40초",f"{score()}/{lives()}/{txt('#time')}",score()==0 and lives()==3 and txt("#time")=="40.0초")
 for _ in range(3):pick(False);step()
 rec("G15","오답 3회 종료","실패·생명0",state()+"/"+str(lives()),state()=="lost" and lives()==0)
 before=(score(),lives());page.keyboard.press("1");step(3000)
 rec("G16","종료 후 입력·시간","점수·생명 변화 없음",f"{score()}/{lives()}",(score(),lives())==before and state()=="lost")
 page.click("#start")
 rec("G17","실패 후 다시 시작","진행·0점·생명3",state()+f"/{score()}/{lives()}",state()=="running" and score()==0 and lives()==3)
 step(40001)
 rec("G18","40초 동안 미응답","시간0·실패",txt("#time")+"/"+state(),txt("#time")=="0.0초" and state()=="lost" and "40초" in txt("#resultText"))
 page.click("#start")
 history=[];always_mismatch=True
 for _ in range(12):
  col=current();history.append(col);always_mismatch &= txt("#word")!=colors[col]
  pick();step()
 rec("G19","정답12개 한 판 완주","성공·12점",state()+"/"+str(score()),state()=="won" and score()==12)
 rec("G20","12문제 출제 규칙","색 연속 중복 없음·뜻과색 다름",str(history),always_mismatch and all(a!=b for a,b in zip(history,history[1:])))
 page.screenshot(path=str(ROOT/"evidence"/"final_win.png"),full_page=True)
 page.click("#start")
 rec("G21","성공 후 다시 시작","진행·점수0·생명3",state()+f"/{score()}/{lives()}",state()=="running" and score()==0 and lives()==3)
 step(1000);pick();step();pick();step()
 page.screenshot(path=str(ROOT/"evidence"/"final_desktop.png"),full_page=True)
 elapsed_before=score()
 page.set_viewport_size({"width":390,"height":844})
 widths=page.evaluate("({scroll:document.documentElement.scrollWidth,viewport:innerWidth})")
 boxes=page.locator(".choice").evaluate_all("(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,w:r.width,h:r.height}})")
 rec("G22","진행 중 모바일로 크기 변경","가로 넘침 없음·점수 유지",str(widths),widths["scroll"]==390 and score()==elapsed_before and state()=="running")
 rec("G23","모바일 버튼 경계·크기","버튼 화면 안·44px 이상",str(boxes),all(x["x"]>=0 and x["right"]<=390 and x["h"]>=44 for x in boxes))
 page.screenshot(path=str(ROOT/"evidence"/"final_mobile.png"),full_page=True)
 for width in [320,360,768,1440]:
  page.set_viewport_size({"width":width,"height":900})
  w=page.evaluate("document.documentElement.scrollWidth")
  rec("G"+str({320:24,360:25,768:26,1440:27}[width]),str(width)+"px 화면","문서 폭=화면 폭",str(w),w==width)
 load(390,True);page.locator("#start").tap();pick(True,"touch")
 rec("G28","터치 환경 정답 선택","점수1·진행",f"{score()}/{state()}",score()==1 and state()=="running")
 step();page.locator("#pause").tap()
 rec("G29","터치 일시정지","일시정지·입력 비활성",state(),state()=="paused" and page.locator(".choice:enabled").count()==0)
 load()
 page.click("#start")
 page.evaluate("""()=>{for(let i=0;i<2;i++){const color=document.querySelector("#word").style.color;
 const map={"rgb(190, 48, 69)":"red","rgb(39, 96, 194)":"blue","rgb(22, 128, 87)":"green","rgb(123, 67, 185)":"purple"};
 document.querySelector('[data-color="'+map[color]+'"]').click();}}""")
 rec("G30","같은 순간 두 번 클릭","점수1만 반영",str(score()),score()==1)
 page.click("#start");page.click("#start");page.click("#start");step(1000)
 t=float(txt("#time").replace("초",""))
 rec("G31","시작 연타 후 시간","타이머 중복 없이 약39초",str(t),38.8<=t<=39.1)
 rec("G32","JavaScript 오류","pageerror 0건",str(errors),not errors)
 browser.close()
result={"environment":"Chromium headless + Playwright; HTML via set_content; timer tests use controlled browser clock; viewport and emulated touch, not physical devices.","tests":rows}
(ROOT/"evidence"/"test_results.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"passed":sum(r["passed"] for r in rows),"total":len(rows),"failed":[r for r in rows if not r["passed"]]},ensure_ascii=False))
