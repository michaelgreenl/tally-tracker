import Foundation

func require(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
  if try !condition() { fatalError(message) }
}

let arguments = CommandLine.arguments
if arguments.count > 1 {
  let store = WidgetStore(directory: URL(fileURLWithPath: arguments[2]))
  for _ in 0..<40 {
    if arguments[1] == "tap" {
      try store.adjust(owner: "alice", counterId: "water", increase: true)
    } else {
      try store.publish(
        owner: "alice",
        counters: [
          WidgetCounter(id: "water", title: "Water", count: 0, increment: 0.1, metric: "bottle")
        ], applied: [])
    }
  }
  exit(0)
}

let directory = FileManager.default.temporaryDirectory.appendingPathComponent(
  "tally-widget-check-\(UUID())")
defer { try? FileManager.default.removeItem(at: directory) }
let store = WidgetStore(directory: directory)
let water = WidgetCounter(id: "water", title: "Water", count: 0, increment: 0.1, metric: "bottle")
try store.publish(owner: "alice", counters: [water], applied: [])

// Separate processes exercise the same file lock used by the app and widget extension.
let children = try (0..<5).map { index -> Process in
  let process = Process()
  process.executableURL = URL(fileURLWithPath: arguments[0])
  process.arguments = [index == 4 ? "publish" : "tap", directory.path]
  try process.run()
  return process
}
for child in children {
  child.waitUntilExit()
  try require(child.terminationStatus == 0, "A concurrent widget writer failed")
}
var state = try store.read()
try require(
  state.counters[0].count == 16 && state.taps.count == 160,
  "Concurrent taps were lost or applied twice")
try require(Set(state.taps.map(\.id)).count == 160, "Each tap needs its own retry identity")

let applied = Set(state.taps.map(\.id))
try store.publish(
  owner: "alice",
  counters: [
    WidgetCounter(id: "water", title: "Water", count: 16, increment: 0.1, metric: "bottle")
  ], applied: applied)
try store.adjust(owner: "alice", counterId: "water", increase: false)
try store.acknowledge(applied)
state = try WidgetStore(directory: directory).read()
try require(
  state.counters[0].count == 15.9 && state.taps.count == 1, "A tap during acknowledgement was lost")

try store.hide()
do {
  try store.adjust(owner: "alice", counterId: "water", increase: true)
  fatalError("A signed-out widget changed a counter")
} catch WidgetStoreError.invalidCounter {}
try store.publish(owner: "bob", counters: [water], applied: [])
try require(store.read().counters[0].count == 0, "Another account received Alice's taps")
try require(store.read().taps.count == 1, "Logout lost an unsent tap")
try store.removeAccount("alice")
try require(
  store.read().taps.isEmpty && store.read().owner == "bob",
  "Account deletion cleared the wrong account")

try store.publish(
  owner: "bob",
  counters: [
    WidgetCounter(
      id: "limit", title: "Limit", count: WidgetStore.maximum, increment: 1, metric: nil)
  ], applied: [])
do {
  try store.adjust(owner: "bob", counterId: "limit", increase: true)
  fatalError("An overflowing tap was accepted")
} catch WidgetStoreError.invalidCounter {}
try require(store.read().taps.isEmpty, "A failed tap entered the journal")
try store.publish(owner: "bob", counters: [water], applied: [])
try store.adjust(owner: "bob", counterId: "water", increase: true)
try store.publish(
  owner: "bob",
  counters: [
    WidgetCounter(
      id: "water", title: "Water", count: WidgetStore.maximum, increment: 0.1, metric: nil)
  ], applied: [])
try require(
  store.read().counters.isEmpty && store.read().taps.count == 1,
  "A range conflict must hide the widget without erasing its pending tap")
try store.publish(owner: "bob", counters: [water], applied: [])
try require(store.read().counters[0].count == 0.1, "A corrected range conflict lost its tap")
try Data("broken".utf8).write(to: directory.appendingPathComponent("widgets.json"))
do {
  _ = try store.read()
  fatalError("Corrupt storage silently erased pending work")
} catch is DecodingError {}
print(
  "Widget store checks passed: cross-process taps, retry handoff, account isolation, limits, corrupt storage."
)
