// theo's day — Scriptable widget
// Paste the URL from the app's Sync screen between the quotes below.

const GIST_URL = "PASTE_YOUR_WIDGET_URL_HERE"

const GREEN = new Color("#1a4d2e")
const CREAM = new Color("#fafaf8")
const OFFWHITE = new Color("#f5f5f2")
const MUTED = new Color("#7a7a7a")
const INK = new Color("#1a1a1a")
const BORDER = new Color("#d0d0cc")

const RED = new Color("#c0392b")
const AMBER = new Color("#e0a800")
const LIGHT = new Color("#52b788")

function progressColor(pct) {
  if (pct >= 100) return GREEN
  if (pct >= 67) return LIGHT
  if (pct >= 34) return AMBER
  return RED
}

async function loadData() {
  const url = GIST_URL + "?t=" + Date.now()
  const req = new Request(url)
  req.headers = { "Cache-Control": "no-cache" }
  return await req.loadJSON()
}

function bar(stack, pct, width) {
  const height = 10
  const track = stack.addStack()
  track.size = new Size(width, height)
  track.cornerRadius = height / 2
  track.backgroundColor = OFFWHITE
  track.borderWidth = 1
  track.borderColor = BORDER
  track.layoutHorizontally()

  const filled = Math.max(0, Math.min(1, pct / 100)) * (width - 4)
  if (filled > 0) {
    const fill = track.addStack()
    fill.size = new Size(filled, height - 4)
    fill.cornerRadius = (height - 4) / 2
    fill.backgroundColor = progressColor(pct)
  }
  track.addSpacer()
}

function label(stack, text, size, color, bold) {
  const t = stack.addText(text)
  t.font = bold ? Font.semiboldSystemFont(size) : Font.systemFont(size)
  t.textColor = color
  return t
}

async function buildWidget() {
  const w = new ListWidget()
  w.backgroundColor = CREAM
  w.setPadding(14, 14, 14, 14)

  let data
  try {
    data = await loadData()
  } catch (e) {
    label(w, "theo's day", 12, GREEN, true)
    w.addSpacer(6)
    label(w, "Can't reach the gist", 12, MUTED)
    return w
  }

  const family = config.widgetFamily || "small"
  const width = family === "medium" ? 300 : 130

  const head = w.addStack()
  head.layoutHorizontally()
  head.centerAlignContent()
  label(head, "theo's day", 11, GREEN, true)
  head.addSpacer()
  label(head, data.pct + "%", 11, progressColor(data.pct), true)

  w.addSpacer(8)

  const big = w.addStack()
  big.layoutHorizontally()
  big.bottomAlignContent()
  const n = big.addText(String(data.done))
  n.font = Font.boldSystemFont(family === "medium" ? 40 : 34)
  n.textColor = INK
  const of = big.addText(" / " + data.total)
  of.font = Font.systemFont(family === "medium" ? 17 : 15)
  of.textColor = MUTED

  w.addSpacer(8)
  bar(w, data.pct, width)
  w.addSpacer(8)

  if (data.pct >= 100) {
    label(w, "All done today", 12, GREEN, true)
  } else {
    const remaining = (data.tasks || []).filter(t => !t.done)
    const showCount = family === "medium" ? 3 : 2
    remaining.slice(0, showCount).forEach(t => {
      const row = w.addStack()
      row.layoutHorizontally()
      label(row, "○ ", 11, MUTED)
      const txt = row.addText(t.text)
      txt.font = Font.systemFont(11)
      txt.textColor = INK
      txt.lineLimit = 1
      w.addSpacer(2)
    })
    if (remaining.length > showCount) {
      label(w, "+" + (remaining.length - showCount) + " more", 10, MUTED)
    }
  }

  w.addSpacer()

  const foot = w.addStack()
  foot.layoutHorizontally()
  const top = (data.streaks || [])[0]
  if (top) {
    label(foot, top.name + " · " + top.count + "d", 10, GREEN, true)
  }
  foot.addSpacer()
  if (data.resolutions && data.resolutions.total) {
    label(foot, data.resolutions.done + "/" + data.resolutions.total + " res", 10, MUTED)
  }

  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
  return w
}

const widget = await buildWidget()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  widget.presentSmall()
}
Script.complete()
