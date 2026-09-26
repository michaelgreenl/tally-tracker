import ExpoModulesCore
import WidgetKit

public class TallyWidgetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TallyWidgets")

    Function("pending") { () throws -> String in
      let data = try JSONEncoder().encode(WidgetStore.shared().read().taps)
      return String(decoding: data, as: UTF8.self)
    }

    Function("publish") { (owner: String, json: String, applied: [String]) throws in
      let counters = try JSONDecoder().decode([WidgetCounter].self, from: Data(json.utf8))
      let store = try WidgetStore.shared()
      let previous = try store.read()
      try store.publish(owner: owner, counters: counters, applied: Set(applied))
      let current = try store.read()
      // Avoid spending WidgetKit's reload budget on unchanged server snapshots.
      if previous.counters != current.counters
        || previous.owner != current.owner
      {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }

    Function("acknowledge") { (ids: [String]) throws in
      try WidgetStore.shared().acknowledge(Set(ids))
    }

    Function("hide") { () throws in
      try WidgetStore.shared().hide()
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("removeAccount") { (owner: String) throws in
      try WidgetStore.shared().removeAccount(owner)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
