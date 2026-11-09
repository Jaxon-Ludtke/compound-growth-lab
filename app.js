(function () {
  "use strict";

  var MAX_YEARS = 60;
  var QUIZ_ANSWERS = { q1: "b", q2: "c", q3: "b", q4: "b" };

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

  function formatMoney(amount) {
    var safe = Number.isFinite(amount) ? amount : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(safe);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = text;
    }
  }

  function readGrowthInputs() {
    return {
      start: clampNumber(document.getElementById("start-amount").value, 0, 10000000, 0),
      monthly: clampNumber(document.getElementById("monthly").value, 0, 100000, 0),
      annualRatePct: clampNumber(document.getElementById("return-rate").value, -50, 50, 0),
      years: Math.round(clampNumber(document.getElementById("years").value, 1, MAX_YEARS, 1))
    };
  }

  function projectGrowth(inputs) {
    var monthlyRate = inputs.annualRatePct / 100 / 12;
    var months = inputs.years * 12;
    var balance = inputs.start;
    var yearlyValues = [balance];

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

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#f8fbff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#d7e0ee";
    ctx.lineWidth = 1;
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
    for (var t = 0; t <= 4; t += 1) {
      var labelVal = maxVal - ((maxVal - minVal) * t) / 4;
      var labelY = pad.top + (plotH * t) / 4;
      ctx.fillText(formatMoney(labelVal), pad.left - 8, labelY);
    }

    if (values.length < 2) {
      return;
    }

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
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5b6b82";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Year 0", pad.left, height - 22);
    ctx.fillText("Year " + String(values.length - 1), width - pad.right, height - 22);
  }

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
  }

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

  function gradeQuiz(event) {
    event.preventDefault();

    var form = document.getElementById("quiz-form");
    var score = 0;
    var answered = 0;
    var keys = Object.keys(QUIZ_ANSWERS);

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
    resultEl.classList.remove("ok", "partial");

    if (answered < keys.length) {
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
  }

  function resetQuizResult() {
    var resultEl = document.getElementById("quiz-result");
    resultEl.textContent = "";
    resultEl.classList.remove("ok", "partial");
  }

  function init() {
    var growthForm = document.getElementById("growth-form");
    var inflationForm = document.getElementById("inflation-form");
    var quizForm = document.getElementById("quiz-form");

    if (growthForm) {
      growthForm.addEventListener("submit", updateGrowth);
      growthForm.addEventListener("input", updateGrowth);
    }
    if (inflationForm) {
      inflationForm.addEventListener("submit", updateInflation);
      inflationForm.addEventListener("input", updateInflation);
    }
    if (quizForm) {
      quizForm.addEventListener("submit", gradeQuiz);
      quizForm.addEventListener("reset", function () {
        window.setTimeout(resetQuizResult, 0);
      });
    }

    updateGrowth();
    updateInflation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
