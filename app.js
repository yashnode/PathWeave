const start = new Date("2026-02-20T00:00:00");
const end = new Date(start);
end.setMonth(end.getMonth() + 6);

const fmt = (d) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const byId = (id) => document.getElementById(id);
const safeSetText = (id, text) => {
  const el = byId(id);
  if (el) el.textContent = text;
};
const safeSetWidth = (id, width) => {
  const el = byId(id);
  if (el) el.style.width = width;
};

safeSetText("startDate", fmt(start));
safeSetText("endDate", fmt(end));

const storageKey = "switchboard-progress-v7";
const monthStorageKey = "switchboard-active-month-v1";
const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
let hideCompleted = false;
const normalizePlan = (rawPlan) => {
  const months = Array.isArray(rawPlan?.months) ? rawPlan.months : [];
  return { months };
};

const loadPlan = async () => {
  if (window.__PLAN_DATA__) {
    const normalized = normalizePlan(window.__PLAN_DATA__);
    if (!normalized.months.length) {
      console.warn("Embedded plan data has no months.");
    }
    return normalized;
  }
  try {
    const response = await fetch("plan.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const raw = await response.json();
    const normalized = normalizePlan(raw);
    if (!normalized.months.length) {
      console.warn("Plan data has no months.");
    }
    return normalized;
  } catch (error) {
    console.error("Failed to load plan.json", error);
    return { months: [] };
  }
};
const slugify = (text) => String(text || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 64);

const normalizeDifficulty = (difficulty) => {
  const value = String(difficulty || "").toLowerCase();
  if (value.includes("easy")) return "easy";
  if (value.includes("medium")) return "medium";
  if (value.includes("hard")) return "hard";
  return "unknown";
};

const normalizePriority = (priority, difficulty) => {
  const value = String(priority || "").toLowerCase();
  if (value === "core" || value === "stretch") return value;
  return difficulty === "hard" ? "stretch" : "core";
};

const normalizeDsaUrl = (url) => {
  let value = String(url || "").trim();
  if (!value) return "";

  const duplicateStart = value.indexOf("https://", 8);
  if (duplicateStart !== -1) value = value.slice(0, duplicateStart);

  value = value.replace(/\/submissions\/[0-9]+\/?$/i, "/description/");

  const leetMatch = value.match(/^https?:\/\/leetcode\.com\/problems\/([^/?#]+)(?:\/.*)?$/i);
  if (leetMatch) {
    return "https://leetcode.com/problems/" + leetMatch[1].toLowerCase() + "/description/";
  }

  return value;
};

const normalizeDsaDump = (rawDump) => {
  const normalized = { topics: [] };
  const seen = new Set();

  (rawDump?.topics || []).forEach((topic, topicIndex) => {
    const topicName = String(topic?.name || ("TOPIC_" + (topicIndex + 1))).trim().toUpperCase();
    const topicKey = slugify(topicName) || ("topic-" + (topicIndex + 1));
    const items = [];

    (topic?.items || []).forEach((item, itemIndex) => {
      const title = String(item?.title || "").trim();
      if (!title) return;

      const url = normalizeDsaUrl(item?.url);
      const dedupeKey = url
        ? (topicName + "|url:" + url.toLowerCase())
        : (topicName + "|title:" + title.toLowerCase());
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      const difficulty = normalizeDifficulty(item?.difficulty);
      const priority = normalizePriority(item?.priority, difficulty);
      const id = String(item?.id || (topicKey + "-" + (slugify(title) || ("item-" + (itemIndex + 1)))));

      items.push({
        id,
        topic: topicName,
        title,
        url,
        difficulty,
        priority
      });
    });

    normalized.topics.push({ name: topicName, items });
  });

  return normalized;
};

const validateDsaDump = (dump) => {
  const issues = [];

  (dump.topics || []).forEach((topic, topicIndex) => {
    if (!topic.name) issues.push("topic[" + topicIndex + "] missing name");

    (topic.items || []).forEach((item, itemIndex) => {
      if (!item.title) issues.push((topic.name || topicIndex) + ".items[" + itemIndex + "] missing title");
      if (item.url && !/^https?:\/\//i.test(item.url)) {
        issues.push((topic.name || topicIndex) + ".items[" + itemIndex + "] has invalid url");
      }
      if (!["easy", "medium", "hard", "unknown"].includes(item.difficulty)) {
        issues.push((topic.name || topicIndex) + ".items[" + itemIndex + "] has invalid difficulty");
      }
      if (!["core", "stretch"].includes(item.priority)) {
        issues.push((topic.name || topicIndex) + ".items[" + itemIndex + "] has invalid priority");
      }
    });
  });

  if (issues.length) {
    console.warn("DSA data validation found " + issues.length + " issue(s).", issues.slice(0, 20));
  }
};

const loadDsaDump = async () => {
  if (window.__DSA_DUMP_DATA__) {
    const normalized = normalizeDsaDump(window.__DSA_DUMP_DATA__);
    validateDsaDump(normalized);
    return normalized;
  }
  try {
    const response = await fetch("dsa_dump.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const raw = await response.json();
    const normalized = normalizeDsaDump(raw);
    validateDsaDump(normalized);
    return normalized;
  } catch (error) {
    console.error("Failed to load dsa_dump.json", error);
    return { topics: [] };
  }
};
const explainDsa = (topic) => {
  const t = topic.toLowerCase();
  if (t.includes("two sum")) {
    return "Why: this is the canonical hash-map lookup pattern used in many array problems. Learn: store seen values with indices, compute complements, and return when you find a match. Also learn to reason about time O(n) vs brute force O(n^2).";
  }
  if (t.includes("duplicate")) {
    return "Why: deduplication is a basic building block for sets and frequency logic. Learn: scan once, insert into a set, and detect repeats in O(1). Also learn how to trade memory for speed.";
  }
  if (t.includes("anagram")) {
    return "Why: frequency counting powers many string tasks. Learn: build a 26-size count array or hashmap and compare signatures. Also learn the idea of 'same multiset of chars'.";
  }
  if (t.includes("stock")) {
    return "Why: introduces running minimum/maximum tracking. Learn: keep the best buy price so far and update profit on each step. Also learn one-pass scanning and invariant thinking.";
  }
  if (t.includes("palindrome")) {
    return "Why: two-pointer thinking appears everywhere in strings. Learn: move left/right inward, skip non-letters if needed, and stop on mismatch. Also learn to avoid extra space.";
  }
  if (t.includes("subsequence")) {
    return "Why: ordered scanning is a core pointer skill. Learn: advance the pointer in the larger string and track matches. Also learn how to reason about relative order, not adjacency.";
  }
  if (t.includes("common prefix")) {
    return "Why: teaches pruning and early exit. Learn: maintain a candidate prefix and shrink when a string fails. Also learn to compare only as much as needed.";
  }
  if (t.includes("substring") || t.includes("window")) {
    return "Why: sliding window is a top interview pattern. Learn: expand to satisfy a condition, then contract while keeping it true. Also learn to track counts in a map and update the best window.";
  }
  if (t.includes("binary search") || t.includes("insert position") || t.includes("first bad")) {
    return "Why: binary search is the fastest way to search sorted data or monotonic answers. Learn: maintain low/high bounds, compute mid safely, and move the correct side. Also learn the 'first/last true' pattern.";
  }
  if (t.includes("linked list")) {
    return "Why: pointer discipline is essential for interviews. Learn: traverse with prev/curr/next and update links safely. Also learn cycle detection using fast/slow pointers.";
  }
  if (t.includes("stack")) {
    return "Why: stacks model nesting and monotonic order. Learn: push/pop rules and how to store pairs (value, index). Also learn when a stack avoids nested loops.";
  }
  if (t.includes("queue")) {
    return "Why: queues model ordered processing and BFS. Learn: enqueue/dequeue and when to use two stacks to simulate a queue. Also learn time amortization.";
  }
  if (t.includes("tree") || t.includes("bst")) {
    return "Why: trees test recursion and traversal. Learn: DFS (pre/in/post) and BFS (level order), and how to return values up the recursion. Also learn base cases clearly.";
  }
  if (t.includes("graph") || t.includes("islands") || t.includes("bipartite")) {
    return "Why: graphs model relationships and connectivity. Learn: BFS/DFS with a visited set and how to count components. Also learn how to avoid infinite loops.";
  }
  if (t.includes("dp") || t.includes("stairs") || t.includes("subsequence") || t.includes("edit")) {
    return "Why: DP is the hardest recurring theme. Learn: define a state, write the recurrence, and memoize or tabulate. Also learn to verify with small examples.";
  }
  if (t.includes("interval")) {
    return "Why: interval merging is a recurring scheduling pattern. Learn: sort by start, merge overlaps, and append results. Also learn why sorting is required.";
  }
  if (t.includes("heap") || t.includes("kth") || t.includes("priority") || t.includes("median")) {
    return "Why: heaps solve top-k and streaming queries. Learn: push/pop to keep the best k elements, and balance two heaps for median. Also learn the heap size invariant.";
  }
  if (t.includes("greedy") || t.includes("jump")) {
    return "Why: greedy problems appear often. Learn: define a locally optimal step and prove it doesn't break the global optimum. Also learn to track the farthest reach.";
  }
  if (t.includes("backtrack") || t.includes("subset") || t.includes("perm") || t.includes("combination")) {
    return "Why: combinatorics is common in interviews. Learn: choose → explore → unchoose recursion and prune invalid paths. Also learn to stop early with constraints.";
  }
  return "Why: builds core interview muscle. Learn: identify the pattern, write clean steps, and explain time/space tradeoffs.";
};

const explainMath = (topic) => {
  const t = topic.toLowerCase();
  if (t.includes("order of operations")) return "Why: every equation and loss formula depends on correct evaluation order. Learn: solve mixed expressions step by step and justify each step using PEMDAS.";
  if (t.includes("fractions")) return "Why: probabilities, rates, and gradients often appear as ratios. Learn: simplify fractions, convert to decimals/percentages, and compare values without calculator shortcuts.";
  if (t.includes("negative")) return "Why: residuals, gradients, and weights can be positive or negative. Learn: master sign rules, absolute value, and subtraction of negatives in multi-step expressions.";
  if (t.includes("variables")) return "Why: models are written with symbols before numbers are known. Learn: isolate variables, substitute cleanly, and check if your final value satisfies the original equation.";
  if (t.includes("exponents")) return "Why: complexity and growth patterns are exponential in many systems. Learn: apply exponent laws, handle roots as fractional powers, and estimate magnitude changes quickly.";
  if (t.includes("ratios")) return "Why: precision/recall, odds, and scaling are ratio-driven. Learn: reduce ratios, set up proportions, and interpret ratio meaning in plain language.";
  if (t.includes("linear equations")) return "Why: linear models are the starting point for ML intuition. Learn: solve one and two-variable equations, then explain slope and intercept in real-world terms.";
  if (t.includes("functions")) return "Why: training is optimizing a function from inputs to outputs. Learn: map input to output, identify domain/range, and compose simple functions correctly.";
  if (t.includes("graph")) return "Why: graphs make behavior and errors visible fast. Learn: plot lines from equations, read slope/intercepts, and infer trend direction from the visual.";
  if (t.includes("vectors")) return "Why: features, embeddings, and gradients are vectors. Learn: add/scale vectors, compute dot products, and explain cosine similarity intuition.";
  if (t.includes("matrices")) return "Why: modern ML pipelines are matrix operations end to end. Learn: track dimensions, do matrix multiplication safely, and interpret matrix transforms.";
  if (t.includes("probability")) return "Why: uncertainty estimation is core to prediction quality. Learn: compute event probabilities, use conditional probability, and apply Bayes reasoning on simple examples.";
  if (t.includes("expected value")) return "Why: expected value defines average reward and average loss. Learn: compute weighted averages and explain what expectation means for repeated trials.";
  if (t.includes("variance") || t.includes("standard deviation")) return "Why: spread controls confidence and model stability. Learn: calculate variance/std dev and interpret how outliers change dispersion.";
  if (t.includes("derivative") || t.includes("gradient")) return "Why: optimization direction comes from derivatives. Learn: compute basic derivatives and explain gradient as steepest local change.";
  if (t.includes("chain rule")) return "Why: backpropagation is repeated chain rule application. Learn: break composite functions into parts and multiply local derivatives in the correct order.";
  if (t.includes("gradient descent")) return "Why: this is the core update rule behind training. Learn: perform one update step manually, reason about learning rate, and detect divergence signs.";
  if (t.includes("loss")) return "Why: loss is the objective your model is judged by. Learn: compute common losses on toy predictions and compare what lower loss actually implies.";
  if (t.includes("attention")) return "Why: attention enables context-aware token weighting in LLMs. Learn: trace query-key-value scoring and explain why some tokens receive higher weight.";
  if (t.includes("transformer")) return "Why: transformers are the backbone of current LLM systems. Learn: walk through one block (attention -> MLP -> residual -> norm) and explain each part's role.";
  if (t.includes("review") || t.includes("recap") || t.includes("quiz")) return "Why: retrieval practice converts short-term study into long-term memory. Learn: solve without notes, mark weak spots, and write one correction rule per mistake.";
  return "Why: each math topic removes a bottleneck for ML and interviews. Learn: define the concept, solve one worked example, and connect it to one practical use.";
};

const classifyDsa = (topic) => {
  const t = topic.toLowerCase();
  if (t.includes("array") || t.includes("string") || t.includes("anagram") || t.includes("substring")) return "Arrays & Strings";
  if (t.includes("two sum") || t.includes("two pointers") || t.includes("palindrome")) return "Two Pointers";
  if (t.includes("sliding window") || t.includes("window")) return "Sliding Window";
  if (t.includes("stack")) return "Stack";
  if (t.includes("queue")) return "Queue";
  if (t.includes("linked list") || t.includes("list")) return "Linked Lists";
  if (t.includes("binary search") || t.includes("rotated") || t.includes("insert position") || t.includes("first bad")) return "Binary Search";
  if (t.includes("tree") || t.includes("bst")) return "Trees";
  if (t.includes("heap") || t.includes("kth") || t.includes("priority") || t.includes("median")) return "Heaps";
  if (t.includes("graph") || t.includes("islands") || t.includes("bipartite") || t.includes("course schedule") || t.includes("ladder")) return "Graphs";
  if (t.includes("dp") || t.includes("dynamic") || t.includes("stairs") || t.includes("robber") || t.includes("subsequence") || t.includes("edit")) return "Dynamic Programming";
  if (t.includes("interval")) return "Intervals";
  if (t.includes("greedy") || t.includes("jump")) return "Greedy";
  if (t.includes("backtrack") || t.includes("subset") || t.includes("perm") || t.includes("combination") || t.includes("parentheses")) return "Backtracking";
  return "General DSA";
};

const classifyMath = (topic) => {
  const t = topic.toLowerCase();
  if (t.includes("arithmetic")) return "Arithmetic";
  if (t.includes("pre-algebra")) return "Pre-Algebra";
  if (t.includes("algebra")) return "Algebra";
  if (t.includes("vector") || t.includes("matrix") || t.includes("linear")) return "Linear Algebra";
  if (t.includes("probability") || t.includes("distribution") || t.includes("bayes")) return "Probability";
  if (t.includes("stat") || t.includes("variance") || t.includes("mean") || t.includes("median") || t.includes("correlation")) return "Statistics";
  if (t.includes("derivative") || t.includes("gradient") || t.includes("calculus") || t.includes("chain rule")) return "Calculus";
  if (t.includes("optimization") || t.includes("loss") || t.includes("regularization") || t.includes("gradient descent")) return "Optimization";
  if (t.includes("attention") || t.includes("transformer") || t.includes("token")) return "LLM/Transformers";
  if (t.includes("rl") || t.includes("reward") || t.includes("policy")) return "Reinforcement Learning";
  if (t.includes("review") || t.includes("recap") || t.includes("quiz")) return "Review";
  return "ML Concepts";
};

const makeHeader = (label, explain, tag) => {
  const wrapper = document.createElement("div");
  wrapper.className = "item header";
  wrapper.dataset.tag = tag || "all";
  const title = document.createElement("h3");
  title.textContent = label;
  const detail = document.createElement("p");
  detail.textContent = explain || "";
  wrapper.appendChild(title);
  wrapper.appendChild(detail);
  return wrapper;
};

const makeSubtask = (id, label, note, type, link) => {
  const row = document.createElement("label");
  row.className = "subtask";
  row.dataset.type = type;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(saved[id]);

  const textWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "subtask-title";
  title.textContent = label;
  const detail = document.createElement("div");
  detail.className = "subtask-note";
  detail.textContent = note;

  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.className = "subtask-link";
    anchor.textContent = "Open problem";
    textWrap.appendChild(anchor);
  }

  textWrap.appendChild(title);
  textWrap.appendChild(detail);

  checkbox.addEventListener("change", () => {
    saved[id] = checkbox.checked;
    localStorage.setItem(storageKey, JSON.stringify(saved));
    updateProgress();
  });

  row.appendChild(checkbox);
  row.appendChild(textWrap);
  return row;
};

const makeDay = (day) => {
  const wrapper = document.createElement("div");
  wrapper.className = "day-card";
  wrapper.dataset.tag = day.tag;
  wrapper.dataset.dsa = day.dsaCategory || "None";
  wrapper.dataset.math = day.mathCategory || "None";

  const header = document.createElement("div");
  header.className = "day-header";
  const title = document.createElement("div");
  title.className = "day-title";
  title.textContent = day.title;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = day.meta;
  header.appendChild(title);
  header.appendChild(meta);

  const topics = document.createElement("div");
  topics.className = "day-topics";
  if (day.dsaCategory) {
    const dsaPill = document.createElement("span");
    dsaPill.className = "topic-pill";
    dsaPill.textContent = `DSA: ${day.dsaCategory}`;
    topics.appendChild(dsaPill);
  }
  if (day.mathCategory) {
    const mathPill = document.createElement("span");
    mathPill.className = "topic-pill alt";
    mathPill.textContent = `Math: ${day.mathCategory}`;
    topics.appendChild(mathPill);
  }
  const typePill = document.createElement("span");
  typePill.className = "topic-pill type";
  typePill.textContent = `Type: ${day.practiceType}`;
  topics.appendChild(typePill);

  const tasks = document.createElement("div");
  tasks.className = "day-tasks";
  tasks.appendChild(makeSubtask(day.taskId, day.taskLabel, day.taskExplain, day.taskType, day.taskLink));

  const companies = document.createElement("div");
  companies.className = "company-tags";
  (day.companies || []).forEach((company) => {
    const pill = document.createElement("span");
    pill.className = "company-pill";
    pill.textContent = company;
    companies.appendChild(pill);
  });

  wrapper.appendChild(header);
  wrapper.appendChild(topics);
  wrapper.appendChild(tasks);
  if (day.companies && day.companies.length) {
    wrapper.appendChild(companies);
  }

  return wrapper;
};

const createSnakeNode = (day, onSelect) => {
  const isSmallScreen = window.innerWidth <= 640;
  const node = document.createElement("div");
  node.className = "day-card snake-node subtask";
  node.dataset.tag = day.tag;
  node.dataset.dsa = day.dsaCategory || "None";
  node.dataset.math = day.mathCategory || "None";
  node.dataset.type = day.taskType;

  const header = document.createElement("div");
  header.className = "snake-node-head";

  const dayNum = document.createElement("div");
  dayNum.className = "snake-day-num";
  dayNum.textContent = `Day ${day.dayNumber} • ${day.title}`;

  const type = document.createElement("span");
  type.className = "snake-type";
  type.textContent = day.taskType === "dsa" ? "DSA" : "Math";
  header.appendChild(dayNum);
  header.appendChild(type);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "snake-check";
  checkbox.checked = Boolean(saved[day.taskId]);

  const title = document.createElement("div");
  title.className = "snake-task-label";
  title.textContent = day.taskLabel;

  const tags = document.createElement("div");
  tags.className = "snake-mini-tags";
  const typeTag = document.createElement("span");
  typeTag.className = "snake-mini-tag";
  typeTag.textContent = day.practiceType;
  tags.appendChild(typeTag);
  const categoryTag = document.createElement("span");
  categoryTag.className = "snake-mini-tag";
  categoryTag.textContent = day.dsaCategory || day.mathCategory || "General";
  tags.appendChild(categoryTag);
  if (!isSmallScreen && day.companies && day.companies.length) {
    const companyTag = document.createElement("span");
    companyTag.className = "snake-mini-tag";
    companyTag.textContent = `${day.companies.length} company tags`;
    tags.appendChild(companyTag);
  }

  let explain = null;
  if (!isSmallScreen) {
    explain = document.createElement("div");
    explain.className = "snake-explain";
    explain.textContent = day.taskExplain;
  }

  const applyCheckedStyle = () => {
    node.classList.toggle("checked", checkbox.checked);
  };
  applyCheckedStyle();

  checkbox.addEventListener("change", (event) => {
    event.stopPropagation();
    saved[day.taskId] = checkbox.checked;
    localStorage.setItem(storageKey, JSON.stringify(saved));
    applyCheckedStyle();
    updateProgress();
    updateVisibility();
  });

  node.addEventListener("click", () => onSelect(day, node));

  node.appendChild(header);
  node.appendChild(checkbox);
  node.appendChild(title);
  node.appendChild(tags);
  if (explain) node.appendChild(explain);
  return node;
};

const createDetailPanel = () => {
  const panel = document.createElement("div");
  panel.className = "snake-detail";

  const title = document.createElement("h3");
  title.className = "snake-detail-title";
  const meta = document.createElement("p");
  meta.className = "snake-detail-meta";
  const note = document.createElement("p");
  note.className = "snake-detail-note";
  const link = document.createElement("a");
  link.className = "subtask-link";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Open problem";
  const tags = document.createElement("div");
  tags.className = "snake-detail-tags";

  panel.appendChild(title);
  panel.appendChild(meta);
  panel.appendChild(note);
  panel.appendChild(link);
  panel.appendChild(tags);

  const render = (day) => {
    title.textContent = day.title;
    meta.textContent = `${day.meta} • ${day.taskLabel}`;
    note.textContent = day.taskExplain;
    if (day.taskLink) {
      link.href = day.taskLink;
      link.classList.remove("hidden");
    } else {
      link.removeAttribute("href");
      link.classList.add("hidden");
    }

    tags.innerHTML = "";
    const addTag = (text, className = "") => {
      const el = document.createElement("span");
      el.className = className ? `topic-pill ${className}` : "topic-pill";
      el.textContent = text;
      tags.appendChild(el);
    };

    addTag(`Type: ${day.practiceType}`, "type");
    if (day.dsaCategory) addTag(`DSA: ${day.dsaCategory}`);
    if (day.mathCategory) addTag(`Math: ${day.mathCategory}`, "alt");
    (day.companies || []).forEach((company) => addTag(company, "alt"));
  };

  return { panel, render };
};

const updateProgress = () => {
  const boxes = document.querySelectorAll(".subtask input[type='checkbox']");
  const dsaBoxes = document.querySelectorAll(".subtask[data-type='dsa'] input[type='checkbox']");
  const mathBoxes = document.querySelectorAll(".subtask[data-type='math'] input[type='checkbox']");

  let done = 0;
  boxes.forEach((box) => {
    if (box.checked) done += 1;
  });

  const countDone = (nodeList) =>
    Array.from(nodeList).reduce((acc, box) => acc + (box.checked ? 1 : 0), 0);

  const total = boxes.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  safeSetText("overallPct", `${pct}%`);
  safeSetWidth("overallBar", `${pct}%`);

  const dsaDone = countDone(dsaBoxes);
  const dsaTotal = dsaBoxes.length;
  const dsaPct = dsaTotal ? Math.round((dsaDone / dsaTotal) * 100) : 0;
  safeSetText("dsaPct", `${dsaPct}%`);
  safeSetWidth("dsaBar", `${dsaPct}%`);

  const mathDone = countDone(mathBoxes);
  const mathTotal = mathBoxes.length;
  const mathPct = mathTotal ? Math.round((mathDone / mathTotal) * 100) : 0;
  safeSetText("mathPct", `${mathPct}%`);
  safeSetWidth("mathBar", `${mathPct}%`);

  const sectionDisplay = document.querySelector("[data-progress-for='master']");
  if (sectionDisplay) sectionDisplay.textContent = `${pct}%`;
};

const updateVisibility = () => {
  document.querySelectorAll(".day-card, .item.header").forEach((item) => {
    if (item.classList.contains("day-card")) {
      const checks = item.querySelectorAll("input[type='checkbox']");
      const allChecked = Array.from(checks).every((c) => c.checked);
      if (hideCompleted && allChecked) {
        item.classList.add("hidden");
      } else {
        item.classList.remove("hidden");
      }
    }
  });
};

const build = (plan, dsaDump) => {
  const list = byId("masterList");
  if (!list) {
    console.warn("Missing #masterList container. Skipping schedule build.");
    return;
  }
  list.innerHTML = "";
  list.classList.add("snake-layout");
  let globalDay = 1;
  const SNAKE_COLS = window.innerWidth <= 640 ? 2 : (window.innerWidth <= 1024 ? 3 : 5);
  let activeNode = null;

  const dsaPools = new Map();
  (dsaDump.topics || []).forEach((topic) => {
    dsaPools.set(topic.name.toUpperCase(), topic.items || []);
  });

  const detail = createDetailPanel();
  list.appendChild(detail.panel);

  const boardWrap = document.createElement("div");
  boardWrap.className = "snake-board-wrap";
  const board = document.createElement("div");
  board.className = "snake-board";
  board.style.setProperty("--snake-cols", String(SNAKE_COLS));
  boardWrap.appendChild(board);
  list.appendChild(boardWrap);

  const selectDay = (day, node) => {
    if (activeNode) activeNode.classList.remove("active");
    activeNode = node;
    activeNode.classList.add("active");
    detail.render(day);
  };

  let firstDay = null;
  let firstNode = null;

  plan.months.forEach((config, monthIndex) => {
    const monthTag = `month-${monthIndex + 1}`;

    const monthPattern = monthIndex === 0
      ? ["math", "math", "math", "dsa", "math", "math", "dsa"]
      : ["dsa", "math"];

    const dsaTopicList = (config.dsaTopics || []).map((t) => t.toUpperCase());
    const dsaPool = dsaTopicList.flatMap((name) => dsaPools.get(name) || []);
    let dsaIndex = 0;

    for (let i = 0; i < 30; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + (globalDay - 1));

      const baseType = monthPattern[i % monthPattern.length];
      const isReview = (i + 1) % 6 === 0;
      const taskType = baseType;
      const practiceType = isReview ? "Review" : (taskType === "math" ? "Concept" : "Problem");

      let topic;
      let explain;
      let category;
      let label;
      let link;

      if (taskType === "math") {
        topic = config.math[i % config.math.length];
        explain = isReview
          ? "Why: spaced repetition. Learn: recall key ideas without notes and fix gaps."
          : explainMath(topic);
        category = classifyMath(topic);
        label = isReview ? `Math Review: ${category}` : `Math/ML: ${topic}`;
      } else {
        if (dsaPool.length) {
          const item = dsaPool[dsaIndex % dsaPool.length];
          dsaIndex += 1;
          topic = item.title;
          link = item.url;
          explain = isReview
            ? "Why: spacing improves recall. Learn: redo 1-2 old problems and explain the pattern."
            : explainDsa(topic);
        } else if (config.dsa && config.dsa.length) {
          topic = config.dsa[i % config.dsa.length];
          explain = isReview
            ? "Why: spacing improves recall. Learn: redo 1-2 old problems and explain the pattern."
            : explainDsa(topic);
        } else {
          topic = "DSA Review";
          explain = "Why: maintain momentum. Learn: revisit a previous pattern.";
        }
        category = classifyDsa(topic);
        label = isReview ? `DSA Review: ${category}` : `DSA: ${topic}`;
      }

      const companyMix = taskType === "dsa" && (globalDay % 5 === 0) ? config.companies : [];
      const meta = `Day ${globalDay} • Month ${monthIndex + 1}`;
      const day = {
        title: fmt(date),
        meta,
        taskLabel: label,
        taskExplain: explain,
        taskType: taskType,
        dayNumber: globalDay,
        taskId: `day-${globalDay}-${taskType}`,
        taskLink: link,
        dsaCategory: taskType === "dsa" ? category : null,
        mathCategory: taskType === "math" ? category : null,
        companies: companyMix,
        tag: monthTag,
        practiceType
      };

      const node = createSnakeNode(day, selectDay);
      const index = globalDay - 1;
      const row = Math.floor(index / SNAKE_COLS) + 1;
      const pos = index % SNAKE_COLS;
      const col = row % 2 === 1 ? pos + 1 : SNAKE_COLS - pos;
      node.style.gridRow = String(row);
      node.style.gridColumn = String(col);
      board.appendChild(node);

      if (!firstDay) {
        firstDay = day;
        firstNode = node;
      }

      globalDay += 1;
    }
  });

  if (firstDay && firstNode) {
    selectDay(firstDay, firstNode);
  }

  updateProgress();
  updateVisibility();
};

const monthFilters = [
  { label: "All", tag: "all" },
  { label: "Month 1", tag: "month-1" },
  { label: "Month 2", tag: "month-2" },
  { label: "Month 3", tag: "month-3" },
  { label: "Month 4", tag: "month-4" },
  { label: "Month 5", tag: "month-5" },
  { label: "Month 6", tag: "month-6" }
];

const getInitialMonthTag = () => {
  const allowed = new Set(monthFilters.map((m) => m.tag));
  const fromStorage = localStorage.getItem(monthStorageKey);
  if (fromStorage && allowed.has(fromStorage)) return fromStorage;
  return "month-1";
};

const filterButtons = byId("filterButtons");
const dsaTopicButtons = byId("dsaTopicButtons");
const mathTopicButtons = byId("mathTopicButtons");

let activeMonth = getInitialMonthTag();
let activeDsa = "all";
let activeMath = "all";

const monthButtonRefs = [];
const dsaButtonRefs = [];
const mathButtonRefs = [];

const syncButtonStates = () => {
  monthButtonRefs.forEach(({ button, tag }) => {
    button.classList.toggle("active", activeMonth === tag);
  });
  dsaButtonRefs.forEach(({ button, value }) => {
    button.classList.toggle("active", activeDsa === value);
  });
  mathButtonRefs.forEach(({ button, value }) => {
    button.classList.toggle("active", activeMath === value);
  });
};

const applyFilters = () => {
  document.querySelectorAll(".day-card, .item.header").forEach((item) => {
    if (item.classList.contains("item") && item.classList.contains("header")) {
      if (activeMonth === "all" || item.dataset.tag === activeMonth) {
        item.classList.remove("hidden");
      } else {
        item.classList.add("hidden");
      }
      return;
    }

    const monthMatch = activeMonth === "all" || item.dataset.tag === activeMonth;
    const dsaMatch = activeDsa === "all" || item.dataset.dsa === activeDsa;
    const mathMatch = activeMath === "all" || item.dataset.math === activeMath;
    if (monthMatch && dsaMatch && mathMatch) {
      item.classList.remove("hidden");
    } else {
      item.classList.add("hidden");
    }
  });
};

if (filterButtons) {
  monthFilters.forEach((filter) => {
    const button = document.createElement("button");
    button.className = "btn ghost";
    button.textContent = filter.label;
    monthButtonRefs.push({ button, tag: filter.tag });
    button.addEventListener("click", () => {
      activeMonth = filter.tag;
      localStorage.setItem(monthStorageKey, activeMonth);
      applyFilters();
      syncButtonStates();
    });
    filterButtons.appendChild(button);
  });
}

const dsaTopics = [
  "All DSA",
  "Arrays & Strings",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Queue",
  "Linked Lists",
  "Binary Search",
  "Trees",
  "Heaps",
  "Graphs",
  "Dynamic Programming",
  "Intervals",
  "Greedy",
  "Backtracking",
  "General DSA"
];

const mathTopics = [
  "All Math",
  "Arithmetic",
  "Pre-Algebra",
  "Algebra",
  "Linear Algebra",
  "Probability",
  "Statistics",
  "Calculus",
  "Optimization",
  "LLM/Transformers",
  "Reinforcement Learning",
  "Review",
  "ML Concepts"
];

if (dsaTopicButtons) {
  dsaTopics.forEach((label) => {
    const button = document.createElement("button");
    button.className = "btn ghost";
    button.textContent = label;
    const value = label === "All DSA" ? "all" : label;
    dsaButtonRefs.push({ button, value });
    button.addEventListener("click", () => {
      activeDsa = value;
      applyFilters();
      syncButtonStates();
    });
    dsaTopicButtons.appendChild(button);
  });
}

if (mathTopicButtons) {
  mathTopics.forEach((label) => {
    const button = document.createElement("button");
    button.className = "btn ghost";
    button.textContent = label;
    const value = label === "All Math" ? "all" : label;
    mathButtonRefs.push({ button, value });
    button.addEventListener("click", () => {
      activeMath = value;
      applyFilters();
      syncButtonStates();
    });
    mathTopicButtons.appendChild(button);
  });
}

syncButtonStates();

const toggleCompletedBtn = byId("toggleCompleted");
if (toggleCompletedBtn) {
  toggleCompletedBtn.addEventListener("click", () => {
    hideCompleted = !hideCompleted;
    toggleCompletedBtn.textContent = hideCompleted ? "Show Completed" : "Hide Completed";
    updateVisibility();
  });
}

const resetBtn = byId("resetProgress");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all progress?")) return;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(monthStorageKey);
    window.location.reload();
  });
}

const init = async () => {
  const [plan, dsaDump] = await Promise.all([loadPlan(), loadDsaDump()]);
  build(plan, dsaDump);
  applyFilters();
  syncButtonStates();
};

init();
