"use strict";
(() => {
  const fruits = [
    {icon:"🍎",name:"사과"},{icon:"🍌",name:"바나나"},
    {icon:"🍇",name:"포도"},{icon:"🍊",name:"귤"},
    {icon:"🍓",name:"딸기"},{icon:"🍉",name:"수박"},
    {icon:"🍒",name:"체리"},{icon:"🍍",name:"파인애플"}
  ];
  const $ = id => document.getElementById(id);
  const board=$("board"), overlay=$("overlay"), mainButton=$("mainButton");
  const TOTAL_MS=60000;
  let state="ready", cards=[], selected=[], pairs=0, moves=0;
  let remaining=TOTAL_MS, deadline=0, raf=0, flipTimer=0;
  let flipDue=0, flipRemaining=0, round=0, busy=false, returnIndex=0;

  function shuffle(list) {
    // Fisher–Yates 방식으로 모든 카드를 매 판 무작위로 섞는다.
    for(let i=list.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [list[i],list[j]]=[list[j],list[i]];
    }
    return list;
  }
  function syncState() {
    document.documentElement.dataset.state=state;
    $("pauseButton").disabled=state!=="playing";
    $("restartButton").disabled=state==="ready" || state==="paused";
    board.setAttribute("aria-busy",String(busy));
  }
  function buildCards(randomize) {
    let deck=[...fruits,...fruits];
    if(randomize) shuffle(deck);
    cards=deck.map((fruit,index)=>({...fruit,index,matched:false,open:false}));
    board.replaceChildren();
    for(const card of cards){
      const button=document.createElement("button");
      button.type="button";button.className="card";button.dataset.index=card.index;
      button.innerHTML=`<span class="card-inner" aria-hidden="true"><span class="face back"><span>?</span></span><span class="face front">${card.icon}</span></span>`;
      button.addEventListener("click",()=>choose(card.index));
      card.element=button; board.append(button);
    }
    paintCards();
  }
  function paintCards() {
    for(const card of cards){
      card.element.classList.toggle("open",card.open);
      card.element.classList.toggle("matched",card.matched);
      // 실제 disabled 대신 aria-disabled와 입력 가드를 사용해 선택 뒤에도 초점을 유지한다.
      card.element.setAttribute("aria-disabled",String(state!=="playing" || busy || card.open || card.matched));
      card.element.setAttribute("aria-label",`${card.index+1}번 ${card.matched?"짝을 맞춘 "+card.name:card.open?card.name:"뒤집힌 카드"}`);
    }
    syncState();
  }
  function paintStats() {
    $("timeValue").textContent=Math.ceil(remaining/1000);
    $("pairsValue").textContent=pairs;
    $("movesValue").textContent=moves;
    $("timeFill").style.width=`${Math.max(0,remaining/TOTAL_MS*100)}%`;
    $("timeTrack").classList.toggle("urgent",remaining<=10000);
    $("timeStat").classList.toggle("urgent",remaining<=10000);
  }
  function cancelWork() {
    cancelAnimationFrame(raf);clearTimeout(flipTimer);raf=0;flipTimer=0;
  }
  function hideDialog() {
    overlay.hidden=true;document.querySelector(".app").inert=false;
  }
  function showDialog({icon,eyebrow,title,text,button,results=false,note=""}){
    $("dialogIcon").textContent=icon;$("dialogEyebrow").textContent=eyebrow;
    $("dialogTitle").textContent=title;$("dialogText").textContent=text;
    $("rules").hidden=true;$("resultDetails").hidden=!results;
    $("dialogNote").textContent=note;mainButton.textContent=button;
    overlay.hidden=false;document.querySelector(".app").inert=true;
    mainButton.focus();
  }
  function startGame(){
    cancelWork();round++;state="playing";selected=[];pairs=0;moves=0;busy=false;
    remaining=TOTAL_MS;flipRemaining=0;flipDue=0;returnIndex=0;
    hideDialog();buildCards(true);paintStats();
    $("status").textContent="과일 8쌍을 찾아보세요!";
    deadline=performance.now()+remaining;
    cards[0].element.focus({preventScroll:true});
    raf=requestAnimationFrame(tick);
  }
  function tick(now){
    if(state!=="playing")return;
    remaining=Math.max(0,deadline-now);paintStats();
    if(remaining<=0){finish(false);return;}
    raf=requestAnimationFrame(tick);
  }
  function choose(index){
    if(state!=="playing" || busy)return;
    remaining=Math.max(0,deadline-performance.now());
    if(remaining<=0){finish(false);return;}
    const card=cards[index];
    if(card.open || card.matched)return;
    card.open=true;selected.push(index);
    if(selected.length===1){
      paintCards();$("status").textContent=`${card.name}! 같은 과일을 찾아보세요.`;return;
    }
    moves++;
    const a=cards[selected[0]],b=cards[selected[1]];
    if(a.name===b.name){
      a.matched=b.matched=true;pairs++;selected=[];
      $("status").textContent=`${a.name} 한 쌍 발견! ${pairs}쌍을 찾았어요.`;
      paintCards();paintStats();if(pairs===8)finish(true);
    }else{
      busy=true;$("status").textContent="다른 과일이에요. 위치를 기억해 두세요!";
      paintCards();paintStats();scheduleFlip(800);
    }
  }
  function scheduleFlip(ms){
    const token=round;flipRemaining=ms;flipDue=performance.now()+ms;
    flipTimer=setTimeout(()=>{
      if(token!==round || state!=="playing")return;
      selected.forEach(i=>cards[i].open=false);selected=[];busy=false;flipRemaining=0;
      paintCards();$("status").textContent="다시 두 장을 골라보세요.";
    },ms);
  }
  function finish(won){
    if(state!=="playing")return;
    remaining=Math.max(0,deadline-performance.now());
    cancelWork();state=won?"won":"lost";busy=false;paintCards();paintStats();
    const elapsed=(TOTAL_MS-remaining)/1000;
    $("resultLabel").textContent=won?"걸린 시간":"찾은 과일";
    $("resultTime").textContent=won?`${elapsed.toFixed(1)}초`:`${pairs} / 8쌍`;
    $("resultMoves").textContent=`${moves}회`;
    $("status").textContent=won?"모든 과일을 찾았어요!":"시간이 끝났어요.";
    showDialog({icon:won?"🏆":"⏳",eyebrow:won?"SWEET SUCCESS!":"ONE MORE TRY?",
      title:won?"달콤한 기억력, 성공!":"아쉽지만, 시간 초과!",
      text:won?"8쌍의 과일을 모두 찾았어요.\n한 번 더 도전해 기록을 줄여볼까요?":`${pairs}쌍의 과일을 찾았어요.\n새로운 카드 배치로 다시 도전해 보세요.`,
      button:"다시 도전하기",results:true,note:"다시 시작하면 카드가 새롭게 섞여요"});
  }
  function pause(){
    if(state!=="playing")return;
    remaining=Math.max(0,deadline-performance.now());
    if(remaining<=0){finish(false);return;}
    const active=document.activeElement;
    returnIndex=Number(active?.dataset?.index??0);
    // 시간뿐 아니라 불일치 카드의 남은 확인 시간도 함께 보존한다.
    if(busy)flipRemaining=Math.max(0,flipDue-performance.now());
    cancelWork();state="paused";paintCards();paintStats();
    showDialog({icon:"🍵",eyebrow:"TAKE A LITTLE BREAK",title:"잠깐 쉬는 중",
      text:"시간과 카드 상태를 그대로 멈췄어요.\n준비되면 이어서 플레이하세요.",
      button:"이어서 하기",note:"P 키로도 일시 정지하거나 이어서 할 수 있어요"});
  }
  function resume(){
    if(state!=="paused" || document.hidden)return;
    state="playing";hideDialog();deadline=performance.now()+remaining;paintCards();
    if(busy)scheduleFlip(flipRemaining);
    raf=requestAnimationFrame(tick);
    cards[returnIndex].element.focus({preventScroll:true});
  }
  mainButton.addEventListener("click",()=>{
    if(state==="paused")resume();
    else if(state!=="playing")startGame();
  });
  $("restartButton").addEventListener("click",startGame);
  $("pauseButton").addEventListener("click",pause);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();});
  document.addEventListener("keydown",event=>{
    if(event.key.toLowerCase()==="p" && !event.repeat){
      if(state==="playing"){event.preventDefault();pause();}
      else if(state==="paused"){event.preventDefault();resume();}
    }
  });
  board.addEventListener("keydown",event=>{
    const index=Number(event.target.dataset.index);
    if(state!=="playing" || !Number.isInteger(index))return;
    const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4};
    if(!(event.key in deltas))return;
    event.preventDefault();
    // 좌우는 같은 행의 경계에서 멈추고, 상하는 보드 위아래 경계에서 멈춘다.
    let next=index+deltas[event.key];
    if(event.key==="ArrowLeft" && index%4===0)next=index;
    if(event.key==="ArrowRight" && index%4===3)next=index;
    next=Math.max(0,Math.min(15,next));
    cards[next].element.focus({preventScroll:true});
  });
  overlay.addEventListener("keydown",event=>{
    if(event.key==="Tab"){event.preventDefault();mainButton.focus();}
  });
  buildCards(false);paintStats();syncState();
  document.querySelector(".app").inert=true;mainButton.focus();
})();
