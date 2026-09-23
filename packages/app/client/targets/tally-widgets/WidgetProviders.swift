import WidgetKit

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

struct ShortcutProvider: TimelineProvider {
  func placeholder(in context: Context) -> CounterEntry { CounterEntry(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (CounterEntry) -> Void) {
    completion(CounterEntry(date: .now))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<CounterEntry>) -> Void) {
    completion(Timeline(entries: [CounterEntry(date: .now)], policy: .never))
  }
}
