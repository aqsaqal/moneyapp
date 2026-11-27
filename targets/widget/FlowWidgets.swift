// Flow home-screen and lock-screen widgets.
//
// The app writes a JSON snapshot (utils/widget.ts) with every string
// already formatted in the user's language, currency and theme; these
// views only lay it out. The App Group id is derived from this
// extension's bundle id (<app>.widget), so the same code serves every
// flavor.

import SwiftUI
import WidgetKit

// MARK: - Snapshot

struct FwRow: Decodable { let label: String; let value: String }
struct FwQuick: Decodable { let label: String; let color: String; let url: String }
struct FwColors: Decodable {
  let bg: String; let bg2: String; let accent: String; let text1: String; let text2: String; let text3: String
  let tone: String; let border: String
}
struct FwSnapshot: Decodable {
  let pro: Bool
  let homeUrl: String
  let lockedText: String
  let lockedUrl: String
  let emptyText: String
  let colors: FwColors
  let title: String
  let perDay: String
  let aDay: String
  let progress: Double
  let dayLine: String
  let verdict: String
  let rows: [FwRow]
  let quickTitle: String
  let quick: [FwQuick]
}

enum FwData {
  static var group: String {
    let id = Bundle.main.bundleIdentifier ?? "com.moneyflow.generic.widget"
    let app = id.hasSuffix(".widget") ? String(id.dropLast(".widget".count)) : id
    return "group.\(app)"
  }

  static func load() -> FwSnapshot? {
    guard let raw = UserDefaults(suiteName: group)?.string(forKey: "snapshot"),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(FwSnapshot.self, from: data)
  }

  static let sample = FwSnapshot(
    pro: true, homeUrl: "flow://", lockedText: "Unlock Flow Pro for this widget", lockedUrl: "flow://paywall",
    emptyText: "Open Flow to set up",
    colors: FwColors(bg: "#0E0E18", bg2: "#1E1E2E", accent: "#00E09E", text1: "#EAEAF2", text2: "#8888AA", text3: "#55556A", tone: "#00E09E", border: "#252538"),
    title: "Safe to spend", perDay: "$47.50", aDay: "a day", progress: 0.6, dayLine: "Day 18 of 30 · 12 days left",
    verdict: "On track · $570 left after bills",
    rows: [FwRow(label: "Left this month", value: "$570.00"), FwRow(label: "Projected end of month", value: "$312.00"),
           FwRow(label: "Bills still due", value: "$240.00"), FwRow(label: "In · out", value: "+$3,200 · −$2,390")],
    quickTitle: "Quick add",
    quick: [FwQuick(label: "Food", color: "#FF6B8A", url: "flow://add"), FwQuick(label: "Transport", color: "#60A5FA", url: "flow://add"),
            FwQuick(label: "Shopping", color: "#FFBE44", url: "flow://add"), FwQuick(label: "More", color: "#55556A", url: "flow://category-grid")])
}

func fwColor(_ hex: String) -> Color {
  var s = hex.trimmingCharacters(in: .whitespaces)
  if s.hasPrefix("#") { s.removeFirst() }
  var alpha: Double = 1
  if s.count == 8 { alpha = Double(Int(s.suffix(2), radix: 16) ?? 255) / 255; s = String(s.prefix(6)) }
  guard s.count == 6, let v = Int(s, radix: 16) else { return .gray }
  return Color(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255, opacity: alpha)
}

struct FwEntry: TimelineEntry {
  let date: Date
  let snap: FwSnapshot?
}

struct FwProvider: TimelineProvider {
  func placeholder(in context: Context) -> FwEntry { FwEntry(date: Date(), snap: FwData.sample) }
  func getSnapshot(in context: Context, completion: @escaping (FwEntry) -> Void) {
    let s = FwData.load()
    completion(FwEntry(date: Date(), snap: context.isPreview && s == nil ? FwData.sample : s))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<FwEntry>) -> Void) {
    // The app reloads the widget itself whenever its numbers change.
    completion(Timeline(entries: [FwEntry(date: Date(), snap: FwData.load())], policy: .never))
  }
}

// MARK: - Shared pieces

struct FwLocked: View {
  let snap: FwSnapshot
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "lock.fill").font(.system(size: 18)).foregroundColor(fwColor(snap.colors.accent))
      Text(snap.lockedText).font(.system(size: 12, weight: .medium)).foregroundColor(fwColor(snap.colors.text2))
        .multilineTextAlignment(.center)
    }
    .padding(12)
    .widgetURL(URL(string: snap.lockedUrl))
  }
}

struct FwEmpty: View {
  let text: String
  var body: some View {
    Text(text).font(.system(size: 13)).foregroundColor(Color.gray).multilineTextAlignment(.center).padding(12)
  }
}

struct FwBar: View {
  let progress: Double
  let track: Color
  let fill: Color
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(track)
        Capsule().fill(fill).frame(width: max(0, min(1, progress)) * geo.size.width)
      }
    }
    .frame(height: 6)
  }
}

// MARK: - Safe to spend

struct SafeToSpendView: View {
  let snap: FwSnapshot
  @Environment(\.widgetFamily) var family

  var body: some View {
    let c = snap.colors
    VStack(alignment: .leading, spacing: 4) {
      Text(snap.title.uppercased()).font(.system(size: 10, weight: .semibold)).tracking(0.8).foregroundColor(fwColor(c.text2))
      HStack(alignment: .lastTextBaseline, spacing: 5) {
        Text(snap.perDay).font(.system(size: family == .systemSmall ? 22 : 28, weight: .bold)).foregroundColor(fwColor(c.text1))
          .minimumScaleFactor(0.6).lineLimit(1)
        Text(snap.aDay).font(.system(size: 12)).foregroundColor(fwColor(c.text2))
      }
      FwBar(progress: snap.progress, track: fwColor(c.bg2), fill: fwColor(c.tone)).padding(.top, 2)
      Text(snap.dayLine).font(.system(size: 11)).foregroundColor(fwColor(c.text3)).lineLimit(1)
      Text(snap.verdict).font(.system(size: 12, weight: .medium)).foregroundColor(fwColor(c.tone))
        .lineLimit(family == .systemSmall ? 2 : 1)
      if family == .systemLarge {
        VStack(spacing: 0) {
          ForEach(Array(snap.rows.enumerated()), id: \.offset) { _, r in
            HStack {
              Text(r.label).font(.system(size: 13)).foregroundColor(fwColor(c.text2))
              Spacer()
              Text(r.value).font(.system(size: 13, weight: .medium)).foregroundColor(fwColor(c.text1))
            }
            .padding(.vertical, 6)
            Divider().overlay(fwColor(c.border))
          }
        }
        .padding(.top, 8)
        Spacer(minLength: 0)
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .widgetURL(URL(string: snap.homeUrl))
  }
}

struct SafeToSpendAccessory: View {
  let snap: FwSnapshot
  @Environment(\.widgetFamily) var family
  var body: some View {
    if family == .accessoryInline {
      Text("\(snap.title): \(snap.perDay) \(snap.aDay)")
    } else {
      VStack(alignment: .leading, spacing: 1) {
        Text(snap.title).font(.system(size: 11, weight: .medium))
        Text("\(snap.perDay) \(snap.aDay)").font(.system(size: 16, weight: .bold)).minimumScaleFactor(0.7).lineLimit(1)
        Text(snap.dayLine).font(.system(size: 10)).lineLimit(1)
      }
      .widgetURL(URL(string: snap.homeUrl))
    }
  }
}

struct SafeToSpendWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FlowSafeToSpend", provider: FwProvider()) { entry in
      FwRoot(entry: entry) { snap, family in
        if family == .accessoryInline || family == .accessoryRectangular {
          SafeToSpendAccessory(snap: snap)
        } else if family != .systemSmall && !snap.pro {
          FwLocked(snap: snap)
        } else {
          SafeToSpendView(snap: snap)
        }
      }
    }
    .configurationDisplayName("Safe to spend")
    .description("What you can spend today, and how the month is going.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
    .contentMarginsDisabled()
  }
}

// MARK: - Quick add

struct QuickAddView: View {
  let snap: FwSnapshot
  var body: some View {
    let c = snap.colors
    VStack(alignment: .leading, spacing: 8) {
      Text(snap.quickTitle.uppercased()).font(.system(size: 10, weight: .semibold)).tracking(0.8).foregroundColor(fwColor(c.text2))
      HStack(spacing: 8) {
        ForEach(Array(snap.quick.prefix(4).enumerated()), id: \.offset) { _, q in
          Link(destination: URL(string: q.url) ?? URL(string: snap.homeUrl)!) {
            VStack(spacing: 5) {
              ZStack {
                Circle().fill(fwColor(q.color).opacity(0.2))
                Circle().fill(fwColor(q.color)).frame(width: 12, height: 12)
              }
              .frame(width: 30, height: 30)
              Text(q.label).font(.system(size: 11)).foregroundColor(fwColor(c.text1)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
          }
        }
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct QuickAddWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FlowQuickAdd", provider: FwProvider()) { entry in
      FwRoot(entry: entry) { snap, _ in
        if snap.pro { QuickAddView(snap: snap) } else { FwLocked(snap: snap) }
      }
    }
    .configurationDisplayName("Quick add")
    .description("Log an expense in your most used categories.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

// MARK: - Root

/// Background in the theme's color, the empty state when the app has not written yet.
struct FwRoot<Content: View>: View {
  let entry: FwEntry
  let content: (FwSnapshot, WidgetFamily) -> Content
  @Environment(\.widgetFamily) var family

  init(entry: FwEntry, @ViewBuilder content: @escaping (FwSnapshot, WidgetFamily) -> Content) {
    self.entry = entry
    self.content = content
  }

  var body: some View {
    let bg = fwColor(entry.snap?.colors.bg ?? "#0E0E18")
    Group {
      if let snap = entry.snap { content(snap, family) } else { FwEmpty(text: "Open the app to set up") }
    }
    .widgetBackground(bg)
  }
}

extension View {
  @ViewBuilder
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { color }
    } else {
      background(color)
    }
  }
}

@main
struct FlowWidgetBundle: WidgetBundle {
  var body: some Widget {
    SafeToSpendWidget()
    QuickAddWidget()
  }
}
