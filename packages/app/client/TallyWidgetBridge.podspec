Pod::Spec.new do |s|
  s.name = 'TallyWidgetBridge'
  s.version = '1.0.0'
  s.summary = 'Tally widget data bridge'
  s.description = 'Shares counter snapshots and durable widget taps with Tally.'
  s.license = { :type => 'ISC' }
  s.author = 'Tally'
  s.homepage = 'https://tallytracker.xyz'
  s.source = { :git => '' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'
  # The pod root includes both targets, so they compile one shared store source.
  s.source_files = 'modules/tally-widgets/ios/*.swift', 'targets/tally-widgets/WidgetStore.swift'
end
