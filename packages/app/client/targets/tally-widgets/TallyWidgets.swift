import AppIntents
import CoreText
import SwiftUI
import UIKit
import WidgetKit

private let tallyURL = URL(string: "tally://home")!
private let accent = Color(red: 15 / 255, green: 120 / 255, blue: 153 / 255)

struct CounterEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Counter"
  static var defaultQuery = CounterQuery()
  let id: String
  let title: String
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }
}

struct CounterQuery: EntityQuery {
  func suggestedEntities() async throws -> [CounterEntity] {
    let state = try WidgetStore.shared().read()
    guard let owner = state.owner else { return [] }
    return state.counters.map { CounterEntity(id: "\(owner)/\($0.id)", title: $0.title) }
  }

  func entities(for identifiers: [String]) async throws -> [CounterEntity] {
    try await suggestedEntities().filter { identifiers.contains($0.id) }
  }

  func defaultResult() async -> CounterEntity? { try? await suggestedEntities().first }
}

struct SelectCounter: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Choose a counter"
  static var description = IntentDescription("Show and change a Tally counter.")
  @Parameter(title: "Counter") var counter: CounterEntity?
}

struct ChangeCounter: AppIntent {
  static var title: LocalizedStringResource = "Change counter"
  static var isDiscoverable = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
  @Parameter(title: "Account") var owner: String
  @Parameter(title: "Counter") var counterId: String
  @Parameter(title: "Increase") var increase: Bool

  init() {}
  init(owner: String, counterId: String, increase: Bool) {
    self.owner = owner
    self.counterId = counterId
    self.increase = increase
  }

  func perform() async throws -> some IntentResult {
    try WidgetStore.shared().adjust(owner: owner, counterId: counterId, increase: increase)
    WidgetCenter.shared.reloadTimelines(ofKind: "TallyCounter")
    return .result()
  }
}

struct CounterEntry: TimelineEntry {
  let date: Date
  var owner: String?
  var counter: WidgetCounter?
}

struct CounterProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> CounterEntry {
    CounterEntry(
      date: .now, owner: "guest",
      counter: WidgetCounter(
        id: "preview", title: "Water", count: 3, increment: 1, metric: "16 oz bottle"
      ))
  }

  func snapshot(for configuration: SelectCounter, in context: Context) async -> CounterEntry {
    if context.isPreview { return placeholder(in: context) }
    return entry(for: configuration)
  }

  func timeline(for configuration: SelectCounter, in context: Context) async -> Timeline<
    CounterEntry
  > {
    Timeline(entries: [entry(for: configuration)], policy: .never)
  }

  private func entry(for configuration: SelectCounter) -> CounterEntry {
    guard let state = try? WidgetStore.shared().read(), let owner = state.owner else {
      return CounterEntry(date: .now)
    }
    // Never replace a deleted counter or another account's selection with an unrelated counter.
    let counter =
      configuration.counter.map { selected in
        state.counters.first { "\(owner)/\($0.id)" == selected.id }
      } ?? state.counters.first
    return CounterEntry(date: .now, owner: owner, counter: counter)
  }
}

struct TallyMark: Shape {
  func path(in rect: CGRect) -> Path {
    let scale = min(rect.width / 24, rect.height / 24)
    let origin = CGPoint(x: rect.midX - 12 * scale, y: rect.midY - 12 * scale)
    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      CGPoint(x: origin.x + x * scale, y: origin.y + y * scale)
    }
    var path = Path()
    for x in [6.0, 10.0, 14.0, 18.0] {
      path.move(to: point(x, 5))
      path.addLine(to: point(x, 19))
    }
    path.move(to: point(3, 17))
    path.addLine(to: point(21, 7))
    return path.strokedPath(StrokeStyle(lineWidth: 2 * scale, lineCap: .round))
  }
}

struct CounterWidgetView: View {
  let entry: CounterEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.widgetRenderingMode) private var renderingMode
  @Environment(\.locale) private var locale
  @ScaledMetric(relativeTo: .headline) private var titleFontSize = 17.0
  @ScaledMetric(relativeTo: .largeTitle) private var countFontSize = 34.0

  var body: some View {
    Group {
      if let counter = entry.counter, let owner = entry.owner {
        Group {
          if family == .systemMedium {
            GeometryReader { geometry in
              HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                  Text(counter.title).font(.headline).lineLimit(2)
                  value(counter)
                  if let metric = counter.metric, !metric.isEmpty {
                    Text(metric).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                  }
                  Spacer(minLength: 0)
                  TallyMark().frame(width: 22, height: 22).accessibilityHidden(true)
                }
                .frame(width: geometry.size.width / 3, alignment: .leading)
                controls(counter, owner: owner)
                  .frame(maxWidth: .infinity, maxHeight: .infinity)
              }
            }
          } else {
            VStack(spacing: 16) {
              HStack(alignment: .top, spacing: 8) {
                alignedText(
                  counter.title,
                  font: .systemFont(ofSize: titleFontSize, weight: .semibold), minimumScale: 1
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                value(counter)
              }
              controls(counter, owner: owner)
            }
            .frame(maxHeight: .infinity, alignment: .top)
          }
        }
        .privacySensitive()
      } else {
        VStack(spacing: 8) {
          TallyMark().frame(width: 32, height: 32)
          Text("Open Tally").font(.headline)
          Text("Add or choose a counter.").font(.caption).multilineTextAlignment(.center)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .foregroundStyle(.white)
    .widgetURL(tallyURL)
    .containerBackground(Color(red: 37 / 255, green: 41 / 255, blue: 46 / 255), for: .widget)
  }

  private func value(_ counter: WidgetCounter) -> some View {
    let baseFont = UIFont.monospacedDigitSystemFont(ofSize: countFontSize, weight: .bold)
    let font = UIFont(
      descriptor: baseFont.fontDescriptor.withDesign(.rounded) ?? baseFont.fontDescriptor,
      size: countFontSize)
    let text = counter.count.formatted(.number.precision(.fractionLength(0...6)).locale(locale))
    return alignedText(text, font: font, minimumScale: 0.35)
      .contentTransition(.numericText(value: counter.count))
  }

  private func alignedText(_ text: String, font: UIFont, minimumScale: CGFloat) -> some View {
    let line = CTLineCreateWithAttributedString(
      NSAttributedString(string: text, attributes: [.font: font]))
    let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
    let top = bounds.isEmpty ? font.capHeight : bounds.maxY
    let width = (text as NSString).size(withAttributes: [.font: font]).width
    return Text(text)
      .font(Font(font))
      .lineLimit(1)
      .minimumScaleFactor(minimumScale)
      // Use the same font for drawing and measuring the visible glyph tops.
      .alignmentGuide(.top) { dimensions in
        let scale = max(minimumScale, min(1, dimensions.width / max(width, 1)))
        return dimensions[.firstTextBaseline] - top * scale
      }
  }

  private func controls(_ counter: WidgetCounter, owner: String) -> some View {
    HStack(spacing: 0) {
      Spacer(minLength: 8)
      control(counter, owner: owner, increase: false)
      Spacer(minLength: 8)
      control(counter, owner: owner, increase: true)
      Spacer(minLength: 8)
    }
  }

  private func control(_ counter: WidgetCounter, owner: String, increase: Bool) -> some View {
    Button(intent: ChangeCounter(owner: owner, counterId: counter.id, increase: increase)) {
      Circle()
        .fill(accent.opacity(renderingMode == .fullColor ? 1 : 0.2))
        .widgetAccentable()
        .overlay {
          Image(systemName: increase ? "plus" : "minus")
            .font(.system(size: 26, weight: .semibold))
        }
        .frame(minWidth: 44, maxWidth: 64, minHeight: 44, maxHeight: 64)
        .aspectRatio(1, contentMode: .fit)
    }
    .buttonStyle(.plain)
    .disabled(
      (try? WidgetStore.adding(counter.count, counter.increment * (increase ? 1 : -1))) == nil
    )
    .accessibilityLabel(increase ? "Increase \(counter.title)" : "Decrease \(counter.title)")
    .accessibilityHint("By \(counter.increment.formatted()). Syncs when Tally opens.")
  }
}

struct TallyCounterWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: "TallyCounter", intent: SelectCounter.self, provider: CounterProvider()
    ) {
      CounterWidgetView(entry: $0)
    }
    .configurationDisplayName("Counter")
    .description("Count without opening Tally. Changes sync when the app opens.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct ShortcutProvider: TimelineProvider {
  func placeholder(in context: Context) -> CounterEntry { CounterEntry(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (CounterEntry) -> Void) {
    completion(CounterEntry(date: .now))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<CounterEntry>) -> Void) {
    completion(Timeline(entries: [CounterEntry(date: .now)], policy: .never))
  }
}

struct ShortcutView: View {
  @Environment(\.widgetFamily) private var family
  var body: some View {
    Group {
      if family == .accessoryCircular {
        TallyMark()
      } else {
        HStack(spacing: 8) {
          TallyMark().frame(width: 44, height: 44)
          Text("Tally").font(.headline)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityLabel("Open Tally")
    .widgetURL(tallyURL)
    .containerBackground(.clear, for: .widget)
  }
}

struct TallyShortcutWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TallyShortcut", provider: ShortcutProvider()) { _ in ShortcutView() }
      .configurationDisplayName("Open Tally")
      .description("Open Tally from your Lock Screen.")
      .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}

@main
struct TallyWidgets: WidgetBundle {
  var body: some Widget {
    TallyCounterWidget()
    TallyShortcutWidget()
  }
}
