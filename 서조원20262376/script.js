"use strict";

// ── 이곳의 설정값과 레시피를 바꾸면 게임을 쉽게 수정할 수 있어요. ──
const GAME_DURATION = 60; // 한 게임의 시간 (초). 0보다 큰 숫자
const CORRECT_SCORE = 100; // 정답 한 잔의 점수

const INGREDIENTS = {
  espresso: "에스프레소",
  water: "물",
  milk: "우유",
  ice: "얼음"
};
const RECIPES = [
  { name: "아메리카노", ingredients: ["espresso", "water"], icon: "☕" },
  { name: "카페라테", ingredients: ["espresso", "milk"], icon: "🥛" },
  { name: "아이스 라테", ingredients: ["espresso", "milk", "ice"], icon: "🧊" }
];

// Set은 같은 재료를 두 번 담지 못하게 해 줍니다.
let selectedIngredients = new Set();
let gameState = "ready"; // ready: 시작 전, playing: 진행 중, ended: 종료
let score = 0;
let completed = 0;
let currentOrder = null;
let timerId = null;
let deadline = 0;

const $ = (id) => document.getElementById(id);
const ingredientButtons = Array.from(document.querySelectorAll("[data-ingredient]"));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// 안내표를 레시피와 같은 데이터로 만들어, 수정할 때 서로 달라지지 않게 합니다.
function renderRecipeGuide() {
  const list = $("recipe-list");
  list.replaceChildren();
  RECIPES.forEach((recipe) => {
    const item = document.createElement("div");
    item.className = "recipe-item";
    const heading = document.createElement("h3");
    const icon = document.createElement("span");
    icon.textContent = recipe.icon || "☕";
    icon.setAttribute("aria-hidden", "true");
    heading.append(icon, document.createTextNode(recipe.name));
    const text = document.createElement("p");
    text.textContent = recipe.ingredients.map((key) => INGREDIENTS[key]).join(" + ");
    item.append(heading, text);
    list.append(item);
  });
  $("intro-duration").textContent = GAME_DURATION;
  $("time").textContent = GAME_DURATION;
  $("points-guide").textContent = CORRECT_SCORE + "점";
}

function showFeedback(message, type = "") {
  $("feedback").textContent = message;
  $("feedback").className = "feedback" + (type ? " " + type : "");
}

function updateScore() {
  $("score").textContent = score;
  $("completed").textContent = completed;
}

function renderSelection() {
  ingredientButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(selectedIngredients.has(button.dataset.ingredient)));
  });
  const tray = $("selected-ingredients");
  tray.replaceChildren();
  if (selectedIngredients.size === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-selection";
    empty.textContent = "아직 담긴 재료가 없어요.";
    tray.append(empty);
    return;
  }
  // 재료 표시는 일정한 순서로 정리하지만, 선택 순서는 판정에 영향을 주지 않습니다.
  Object.keys(INGREDIENTS).forEach((key) => {
    if (!selectedIngredients.has(key)) return;
    const chip = document.createElement("span");
    chip.className = "ingredient-chip";
    chip.textContent = INGREDIENTS[key];
    tray.append(chip);
  });
}

function resetSelection() {
  selectedIngredients.clear();
  renderSelection();
}

// CSS 효과만 다시 시작합니다. 점수나 게임 진행을 애니메이션에 의존하지 않습니다.
function replayAnimation(element, className) {
  element.classList.remove(className);
  if (reducedMotion.matches) return;
  void element.offsetWidth;
  element.classList.add(className);
}

function nextOrder() {
  // 직전 음료를 제외한 후보에서 무작위 선택하여 새 주문이 잘 구분되게 합니다.
  const candidates = RECIPES.filter((recipe) => recipe !== currentOrder);
  const pool = candidates.length ? candidates : RECIPES;
  currentOrder = pool[Math.floor(Math.random() * pool.length)];
  resetSelection();
  $("order-name").textContent = currentOrder.name;
  $("order-number").textContent = (completed + 1) + "번째 손님";
  $("order-panel").classList.remove("shake");
  replayAnimation($("order-panel"), "order-enter");
}

// 남은 횟수를 빼는 대신 실제 종료 시각과 비교합니다.
// 탭이 숨겨져 타이머 호출이 늦어져도 플레이 시간이 늘어나지 않습니다.
function updateTimer() {
  if (gameState !== "playing") return;
  const remaining = Math.max(0, deadline - performance.now());
  $("time").textContent = Math.ceil(remaining / 1000);
  $("time-bar").style.transform = "scaleX(" + (remaining / (GAME_DURATION * 1000)) + ")";
  document.querySelector(".timer-stat").classList.toggle("urgent", remaining > 0 && remaining <= 10000);
  if (remaining <= 0) finishGame();
}

// 이벤트가 먼저 도착하더라도 마감 시각이 지났으면 입력을 받지 않습니다.
function canInteract() {
  if (gameState !== "playing") return false;
  if (performance.now() >= deadline) {
    finishGame();
    return false;
  }
  return true;
}

function startGame() {
  // 기존 타이머를 반드시 해제하므로 재시작해도 타이머는 하나뿐입니다.
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;
  gameState = "playing";
  score = 0;
  completed = 0;
  currentOrder = null;
  resetSelection();
  updateScore();
  $("points-layer").replaceChildren();
  $("order-panel").classList.remove("shake", "order-enter");
  ingredientButtons.forEach((button) => button.classList.remove("pop"));
  $("welcome-panel").hidden = true;
  $("result-panel").hidden = true;
  $("order-panel").hidden = false;
  $("controls").disabled = false;
  $("shop-state").textContent = "따뜻하게 영업 중";
  $("timer-tag").textContent = "영업 중";
  showFeedback("첫 손님이 왔어요! 주문에 맞는 재료를 골라 주세요.", "info");
  nextOrder();
  deadline = performance.now() + GAME_DURATION * 1000;
  updateTimer();
  timerId = window.setInterval(updateTimer, 100);
  ingredientButtons[0].focus({ preventScroll: true });
}

function toggleIngredient(button) {
  if (!canInteract()) return;
  const ingredient = button.dataset.ingredient;
  if (selectedIngredients.has(ingredient)) {
    selectedIngredients.delete(ingredient);
  } else {
    selectedIngredients.add(ingredient);
    replayAnimation(button, "pop");
  }
  renderSelection();
}

function clearIngredients() {
  if (!canInteract()) return;
  resetSelection();
  showFeedback("재료를 모두 비웠어요. 새롭게 골라 주세요.", "info");
}

function showFloatingPoints() {
  const label = document.createElement("span");
  label.className = "floating-points";
  label.textContent = "+" + CORRECT_SCORE + "점";
  $("points-layer").append(label);
  // 이 콜백은 장식만 제거합니다. 게임 상태나 점수는 절대 변경하지 않습니다.
  const removeLabel = () => label.remove();
  label.addEventListener("animationend", removeLabel, { once: true });
  window.setTimeout(removeLabel, 1000); // 모션 축소 설정에서도 장식이 남지 않도록 정리
}

function submitDrink() {
  if (!canInteract()) return;
  if (selectedIngredients.size === 0) {
    showFeedback("먼저 재료를 하나 이상 선택해 주세요.", "error");
    return;
  }

  // 개수와 모든 재료가 일치해야 정답입니다. 선택 순서는 무관합니다.
  const isCorrect = selectedIngredients.size === currentOrder.ingredients.length &&
    currentOrder.ingredients.every((ingredient) => selectedIngredients.has(ingredient));

  if (isCorrect) {
    const servedName = currentOrder.name;
    score += CORRECT_SCORE;
    completed += 1;
    updateScore();
    showFloatingPoints();
    // 다음 주문과 선택 초기화를 즉시 처리하여 연속 클릭으로 중복 채점하지 않습니다.
    nextOrder();
    showFeedback(servedName + " 완성! +" + CORRECT_SCORE + "점 · 다음 손님이 기다려요.", "success");
  } else {
    resetSelection();
    $("order-panel").classList.remove("order-enter");
    replayAnimation($("order-panel"), "shake");
    showFeedback("레시피와 달라요. 재료를 비웠어요. 같은 주문에 다시 도전해요!", "error");
  }
}

function finishGame() {
  // 종료 함수를 여러 번 호출해도 한 번만 처리합니다.
  if (gameState !== "playing") return;
  gameState = "ended";
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;
  $("time").textContent = "0";
  $("time-bar").style.transform = "scaleX(0)";
  document.querySelector(".timer-stat").classList.remove("urgent");
  $("controls").disabled = true;
  $("order-panel").hidden = true;
  $("result-panel").hidden = false;
  $("points-layer").replaceChildren();
  $("shop-state").textContent = "오늘의 영업 마감";
  $("timer-tag").textContent = "영업 종료";
  $("final-score").textContent = score + "점";
  $("final-completed").textContent = completed + "잔";
  showFeedback("시간이 끝났어요! 최종 " + score + "점, 성공 주문 " + completed + "잔이에요.", "info");
  $("restart-button").focus({ preventScroll: true });
}

// click만 사용하면 마우스·터치·키보드를 모두 지원하며,
// touchstart와 click을 함께 등록할 때 생기는 이중 실행도 피할 수 있습니다.
$("start-button").addEventListener("click", startGame);
$("restart-button").addEventListener("click", startGame);
ingredientButtons.forEach((button) => {
  button.addEventListener("click", () => toggleIngredient(button));
  button.addEventListener("animationend", () => button.classList.remove("pop"));
});
$("clear-button").addEventListener("click", clearIngredients);
$("submit-button").addEventListener("click", submitDrink);
$("order-panel").addEventListener("animationend", () => {
  $("order-panel").classList.remove("order-enter", "shake");
});
document.addEventListener("visibilitychange", updateTimer);
window.addEventListener("pageshow", updateTimer);
window.addEventListener("focus", updateTimer);

renderRecipeGuide();
renderSelection();
updateScore();
