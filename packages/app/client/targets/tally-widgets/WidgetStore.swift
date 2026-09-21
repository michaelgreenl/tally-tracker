import Darwin
import Foundation

struct WidgetCounter: Codable, Identifiable, Equatable {
  let id: String
  let title: String
  var count: Double
  let increment: Double
  let metric: String?
}

struct WidgetTap: Codable {
  let id: String
  let owner: String
  let counterId: String
  let amount: Double
}

struct WidgetState: Codable {
  var owner: String?
  var counters: [WidgetCounter] = []
  var taps: [WidgetTap] = []
}

enum WidgetStoreError: Error {
  case unavailable, invalidCounter
}

// Both processes use this file. Never replace it with an unlocked UserDefaults read/write.
// ponytail: whole-file journal; use SQLite if long offline queues make writes slow.
struct WidgetStore {
  static let group = "group.com.tallytracker.app"
  static let scale = 1_000_000.0
  static let maximum = 999_999_999.999999
  let directory: URL

  static func shared() throws -> WidgetStore {
    guard
      let directory = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: group
      )
    else { throw WidgetStoreError.unavailable }
    return WidgetStore(directory: directory)
  }

  private func access<T>(write: Bool = false, _ operation: (inout WidgetState) throws -> T) throws
    -> T
  {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let lock = open(
      directory.appendingPathComponent("widgets.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard lock >= 0 else { throw WidgetStoreError.unavailable }
    defer { close(lock) }
    while flock(lock, LOCK_EX) != 0 {
      if errno != EINTR { throw WidgetStoreError.unavailable }
    }
    defer { flock(lock, LOCK_UN) }
    let url = directory.appendingPathComponent("widgets.json")
    var state: WidgetState
    do {
      state = try JSONDecoder().decode(WidgetState.self, from: Data(contentsOf: url))
    } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
      state = WidgetState()
    }
    let result = try operation(&state)
    if write {
      var options: Data.WritingOptions = [.atomic]
      #if os(iOS)
        options.insert(.completeFileProtectionUntilFirstUserAuthentication)
      #endif
      try JSONEncoder().encode(state).write(to: url, options: options)
    }
    return result
  }

  func read() throws -> WidgetState { try access { $0 } }

  static func valid(_ value: Double) -> Bool {
    value.isFinite && abs(value) <= maximum && value == (value * scale).rounded() / scale
  }

  static func adding(_ value: Double, _ amount: Double) throws -> Double {
    guard valid(value), valid(amount) else { throw WidgetStoreError.invalidCounter }
    let next = ((value * scale).rounded() + (amount * scale).rounded()) / scale
    guard valid(next) else { throw WidgetStoreError.invalidCounter }
    return next
  }

  func publish(owner: String, counters: [WidgetCounter], applied: Set<String>) throws {
    guard !owner.isEmpty, Set(counters.map(\.id)).count == counters.count,
      counters.allSatisfy({
        !$0.id.isEmpty && !$0.title.isEmpty && Self.valid($0.count)
          && Self.valid($0.increment) && $0.increment > 0
      })
    else { throw WidgetStoreError.invalidCounter }
    try access(write: true) { state in
      var next = counters
      for tap in state.taps where tap.owner == owner && !applied.contains(tap.id) {
        if let index = next.firstIndex(where: { $0.id == tap.counterId }) {
          if let count = try? Self.adding(next[index].count, tap.amount) {
            next[index].count = count
          } else {
            // A remote change can exhaust the range. Keep the tap and open Tally to resolve it.
            next.remove(at: index)
          }
        }
      }
      state.owner = owner
      state.counters = next
    }
  }

  func adjust(owner: String, counterId: String, increase: Bool) throws {
    try access(write: true) { state in
      // Old timelines and an old account's widgets cannot change the current account.
      guard state.owner == owner,
        let index = state.counters.firstIndex(where: { $0.id == counterId })
      else { throw WidgetStoreError.invalidCounter }
      let amount = state.counters[index].increment * (increase ? 1 : -1)
      state.counters[index].count = try Self.adding(state.counters[index].count, amount)
      state.taps.append(
        WidgetTap(id: UUID().uuidString, owner: owner, counterId: counterId, amount: amount))
    }
  }

  func acknowledge(_ ids: Set<String>) throws {
    try access(write: true) { $0.taps.removeAll { ids.contains($0.id) } }
  }

  func hide() throws {
    try access(write: true) { state in
      state.owner = nil
      state.counters = []
    }
  }

  func removeAccount(_ owner: String) throws {
    try access(write: true) { state in
      state.taps.removeAll { $0.owner == owner }
      if state.owner == owner {
        state.owner = nil
        state.counters = []
      }
    }
  }
}
