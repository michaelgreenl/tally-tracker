import SwiftUI
import WidgetKit

struct TallyCounterWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: "TallyCounter", intent: SelectCounter.self, provider: CounterProvider()
    ) {
      CounterWidgetView(entry: $0)
    }
    .configurationDisplayName("Counter")
    .description("Count without opening Tally. Changes sync when the app opens.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    .contentMarginsDisabled()
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
