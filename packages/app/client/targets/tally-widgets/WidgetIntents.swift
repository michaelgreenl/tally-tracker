import AppIntents
import WidgetKit

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
