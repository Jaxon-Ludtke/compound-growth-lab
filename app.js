// This whole file sits inside a function that runs immediately. That way our variable names stay private to this file. "use strict" makes messy mistakes throw an error instead of failing silently.
(function () {
  "use strict";

  // MAX_YEARS is the longest run we will project. QUIZ_ANSWERS is the answer key. The q names match the radio button groups in the HTML, and the letter is the right choice.
  var MAX_YEARS = 60;
  var QUIZ_ANSWERS = { q1: "b", q2: "c", q3: "b", q4: "b" };

  // A function is a chunk of code you can call again. clampNumber keeps a typed value inside a min and max. If it is not a real number, we return fallback instead of doing bad math.
  function clampNumber(value, min, max, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return fallback;
    }
    if (n < min) {
      return min;
    }
    if (n > max) {
      return max;
    }
    return n;
  }

  // Turns a number into dollars, like $1,234. NumberFormat is built into the browser, so no outside library.
  function formatMoney(amount) {
    var safe = Number.isFinite(amount) ? amount : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(safe);
  }

  // The DOM is the live tree of HTML elements that JavaScript can change. document.getElementById finds one element by its id. textContent sets the words, and it does not read them as HTML.
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = text;
    }
  }

  // localStorage is a small storage space in the browser. It keeps strings after you refresh. JSON.stringify turns the inputs object into text. The key cgl.calculatorInputs is the name we store it under.
  function saveCalculatorInputs(inputs) {

    // try/catch runs the code in try. If storage is blocked, catch runs and we just stop, so the page does not crash.
    try {
      localStorage.setItem("cgl.calculatorInputs", JSON.stringify(inputs));
    } catch (err) {
      return;
    }
  }

  // On load, read the saved calculator text back. JSON.parse turns that text into an object. Missing or broken text is ignored and the boxes keep the default values from the HTML. The real range check happens later in clampNumber.
  function restoreCalculatorInputs() {
    var saved = null;
    try {

      // getItem returns the saved string, or null if we never saved.
      var raw = localStorage.getItem("cgl.calculatorInputs");
      if (!raw) {
        return;
      }
      saved = JSON.parse(raw);
    } catch (err) {
      return;
    }

    // Ignore it if the parsed value is not an object, like if someone saved a plain number.
    if (!saved || typeof saved !== "object") {
      return;
    }
    if (saved.start !== undefined && saved.start !== null) {
      document.getElementById("start-amount").value = saved.start;
    }
    if (saved.monthly !== undefined && saved.monthly !== null) {
      document.getElementById("monthly").value = saved.monthly;
    }
    if (saved.annualRatePct !== undefined && saved.annualRatePct !== null) {
      document.getElementById("return-rate").value = saved.annualRatePct;
    }
    if (saved.years !== undefined && saved.years !== null) {
      document.getElementById("years").value = saved.years;
    }
  }

  // Best quiz score is stored under cgl.bestQuizScore. localStorage gives us text, so Number() turns "3" back into a number. Blank or junk means there is no score yet.
  function readBestQuizScore() {
    try {
      var raw = localStorage.getItem("cgl.bestQuizScore");
      if (raw == null || raw === "") {
        return null;
      }
      var score = Number(raw);
      if (!Number.isFinite(score)) {
        return null;
      }
      return score;
    } catch (err) {
      return null;
    }
  }

  // Writes "Best score: 3/4" into the small paragraph, or clears it when there is no score. The 4 comes from how many questions are in the answer key.
  function showBestQuizScore(score) {
    var total = Object.keys(QUIZ_ANSWERS).length;
    if (score == null) {
      setText("best-quiz-score", "");
      return;
    }
    setText("best-quiz-score", "Best score: " + String(score) + "/" + String(total));
  }

  // Keep the higher score. A worse attempt should not wipe a better one. String(best) is what we actually store, because localStorage only holds text.
  function saveBestQuizScore(score) {
    var best = score;
    var previous = readBestQuizScore();
    if (previous != null && previous > best) {
      best = previous;
    }
    try {
      localStorage.setItem("cgl.bestQuizScore", String(best));
    } catch (err) {
      showBestQuizScore(best);
      return;
    }
    showBestQuizScore(best);
  }

  // Puts the four calculator boxes back to 5000, 300, 7, and 20, clears the best score text, redraws the chart, then removeItem deletes both saved keys.
  function resetSavedData(event) {
    if (event) {
      event.preventDefault();
    }
    document.getElementById("start-amount").value = "5000";
    document.getElementById("monthly").value = "300";
    document.getElementById("return-rate").value = "7";
    document.getElementById("years").value = "20";
    showBestQuizScore(null);
    updateGrowth();
    try {
      localStorage.removeItem("cgl.calculatorInputs");
      localStorage.removeItem("cgl.bestQuizScore");
    } catch (err) {
      return;
    }
  }

  // Read the four boxes and run each one through clampNumber so a blank or huge value cannot break the projection.
  function readGrowthInputs() {
    return {
      start: clampNumber(document.getElementById("start-amount").value, 0, 10000000, 0),
      monthly: clampNumber(document.getElementById("monthly").value, 0, 100000, 0),
      annualRatePct: clampNumber(document.getElementById("return-rate").value, -50, 50, 0),
      years: Math.round(clampNumber(document.getElementById("years").value, 1, MAX_YEARS, 1))
    };
  }

  // Compound growth, simplified. Divide the yearly rate by 12, then once a month grow the balance and add the contribution. Save a snapshot each year for the chart.
  function projectGrowth(inputs) {
    var monthlyRate = inputs.annualRatePct / 100 / 12;
    var months = inputs.years * 12;
    var balance = inputs.start;
    var yearlyValues = [balance];

    // m is the month number. Every 12th month we push the balance into yearlyValues.
    for (var m = 1; m <= months; m += 1) {
      balance = balance * (1 + monthlyRate) + inputs.monthly;
      if (m % 12 === 0) {
        yearlyValues.push(balance);
      }
    }

    var totalContributions = inputs.start + inputs.monthly * months;
    var growth = balance - totalContributions;

    return {
      futureValue: balance,
      totalContributions: totalContributions,
      growth: growth,
      yearlyValues: yearlyValues
    };
  }

  // A canvas is the drawing area in the page. getContext("2d") is how we paint on it. This draws grid lines, dollar labels, and the growth line.
  function drawChart(values) {
    var canvas = document.getElementById("growth-chart");
    if (!canvas || !canvas.getContext) {
      return;
    }

    var ctx = canvas.getContext("2d");
    var width = canvas.width;
    var height = canvas.height;
    var pad = { top: 18, right: 18, bottom: 34, left: 58 };
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;
    var maxVal = Math.max.apply(null, values.concat([1]));
    var minVal = 0;

    // Clear the old chart and fill a light background before drawing again.
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#f8fbff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#d7e0ee";
    ctx.lineWidth = 1;

    // Four horizontal grid lines.
    for (var g = 0; g <= 4; g += 1) {
      var y = pad.top + (plotH * g) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#5b6b82";
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    // Dollar labels on the left, from the biggest value at the top down to zero.
    for (var t = 0; t <= 4; t += 1) {
      var labelVal = maxVal - ((maxVal - minVal) * t) / 4;
      var labelY = pad.top + (plotH * t) / 4;
      ctx.fillText(formatMoney(labelVal), pad.left - 8, labelY);
    }

    if (values.length < 2) {
      return;
    }

    // Start the growth line. x and y are the pixel spot for each year.
    ctx.beginPath();
    ctx.strokeStyle = "#0f6e56";
    ctx.lineWidth = 2.5;
    for (var i = 0; i < values.length; i += 1) {
      var x = pad.left + (plotW * i) / (values.length - 1);
      var yPoint = pad.top + plotH * (1 - (values[i] - minVal) / (maxVal - minVal));
      if (i === 0) {
        ctx.moveTo(x, yPoint);
      } else {
        ctx.lineTo(x, yPoint);
      }
    }
    ctx.stroke();

    var lastX = pad.left + plotW;
    var lastY = pad.top + plotH * (1 - (values[values.length - 1] - minVal) / (maxVal - minVal));
    ctx.fillStyle = "#0f6e56";
    ctx.beginPath();

    // A dot on the last year so the ending balance is easy to see.
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5b6b82";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Labels under the first year and the last year.
    ctx.fillText("Year 0", pad.left, height - 22);
    ctx.fillText("Year " + String(values.length - 1), width - pad.right, height - 22);
  }

  // Rebuilds the projection, the three totals, the caption, and the chart. preventDefault stops the form from reloading the page. We only write localStorage when a real event came in, meaning the person changed an input. The first automatic call does not save.
  function updateGrowth(event) {
    if (event) {
      event.preventDefault();
    }

    var inputs = readGrowthInputs();
    document.getElementById("start-amount").value = String(inputs.start);
    document.getElementById("monthly").value = String(inputs.monthly);
    document.getElementById("return-rate").value = String(inputs.annualRatePct);
    document.getElementById("years").value = String(inputs.years);

    var result = projectGrowth(inputs);
    setText("future-value", formatMoney(result.futureValue));
    setText("total-contributions", formatMoney(result.totalContributions));
    setText("estimated-growth", formatMoney(result.growth));
    setText(
      "chart-caption",
      "Projected balance over " +
        String(inputs.years) +
        " years at " +
        String(inputs.annualRatePct) +
        "% average annual return (simplified model)."
    );
    drawChart(result.yearlyValues);
    if (event) {
      saveCalculatorInputs(inputs);
    }
  }

  // Same kind of update for inflation. futureEquivalent is the later dollar amount that buys the same stuff. purchasingPower is what today's cash would feel like after those years.
  function updateInflation(event) {
    if (event) {
      event.preventDefault();
    }

    var today = clampNumber(document.getElementById("today-amount").value, 0, 10000000, 0);
    var ratePct = clampNumber(document.getElementById("inflation-rate").value, 0, 30, 0);
    var years = Math.round(clampNumber(document.getElementById("inflation-years").value, 1, MAX_YEARS, 1));

    document.getElementById("today-amount").value = String(today);
    document.getElementById("inflation-rate").value = String(ratePct);
    document.getElementById("inflation-years").value = String(years);

    var futureEquivalent = today * Math.pow(1 + ratePct / 100, years);
    var purchasingPower = ratePct === -100 ? 0 : today / Math.pow(1 + ratePct / 100, years);

    var message =
      formatMoney(today) +
      " today would need about " +
      formatMoney(futureEquivalent) +
      " in " +
      String(years) +
      " years to buy the same things at " +
      String(ratePct) +
      "% average inflation. Leaving " +
      formatMoney(today) +
      " unchanged would feel closer to " +
      formatMoney(purchasingPower) +
      " in today’s dollars.";

    setText("inflation-result", message);
  }

  // Called when the quiz form is submitted. Counts picked answers and correct ones, then writes the message into the result paragraph.
  function gradeQuiz(event) {
    event.preventDefault();

    var form = document.getElementById("quiz-form");
    var score = 0;
    var answered = 0;
    var keys = Object.keys(QUIZ_ANSWERS);

    // namedItem gets the radio group for that question. .value is the picked letter, or empty if nothing is picked.
    for (var i = 0; i < keys.length; i += 1) {
      var name = keys[i];
      var selected = form.elements.namedItem(name);
      var value = selected && selected.value ? selected.value : "";
      if (value) {
        answered += 1;
        if (value === QUIZ_ANSWERS[name]) {
          score += 1;
        }
      }
    }

    var resultEl = document.getElementById("quiz-result");

    // classList adds or removes a class so the CSS can color the message green or brown.
    resultEl.classList.remove("ok", "partial");

    if (answered < keys.length) {

      // Leave a question blank and we stop. No best score is saved for a half finished quiz.
      resultEl.textContent = "Answer all four questions, then check again.";
      resultEl.classList.add("partial");
      return;
    }

    var text = "You got " + String(score) + " out of " + String(keys.length) + " correct.";
    if (score === keys.length) {
      text += " Nice work — compounding, inflation, and diversification are solid foundations.";
      resultEl.classList.add("ok");
    } else {
      text += " Review the concept cards below and try once more.";
      resultEl.classList.add("partial");
    }
    resultEl.textContent = text;

    // A finished quiz updates the stored best score and the small text under the result.
    saveBestQuizScore(score);
  }

  // The reset button already clears the radios. This clears the old score sentence. It does not touch the saved best score.
  function resetQuizResult() {
    var resultEl = document.getElementById("quiz-result");
    resultEl.textContent = "";
    resultEl.classList.remove("ok", "partial");
  }

  // init connects the HTML to these functions once the page is ready.
  function init() {
    var growthForm = document.getElementById("growth-form");
    var inflationForm = document.getElementById("inflation-form");
    var quizForm = document.getElementById("quiz-form");

    if (growthForm) {

      // An event listener is a function that runs when something happens. submit fires when you hit Update projection. input fires when a calculator field changes. Both call updateGrowth, which is when the numbers get saved.
      growthForm.addEventListener("submit", updateGrowth);
      growthForm.addEventListener("input", updateGrowth);
    }
    if (inflationForm) {

      // Same two listeners for the inflation form. Typing updates the sentence right away.
      inflationForm.addEventListener("submit", updateInflation);
      inflationForm.addEventListener("input", updateInflation);
    }
    if (quizForm) {

      // submit on the quiz runs the grader. reset fires for the Reset quiz button. setTimeout waits a beat so the browser can clear the radios before we clear the message.
      quizForm.addEventListener("submit", gradeQuiz);
      quizForm.addEventListener("reset", function () {
        window.setTimeout(resetQuizResult, 0);
      });
    }
    var resetSavedButton = document.getElementById("reset-saved");
    if (resetSavedButton) {

      // click on Reset saved data. It is not a submit, so it needs its own click listener.
      resetSavedButton.addEventListener("click", resetSavedData);
    }

    // Fill the boxes from storage first, show any saved best score, then draw the starting projection and inflation sentence.
    restoreCalculatorInputs();
    showBestQuizScore(readBestQuizScore());
    updateGrowth();
    updateInflation();
  }

  // DOMContentLoaded means the HTML elements exist. If they already do, call init now. defer on the script tag usually means we are ready, but this covers both cases.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
