import SwiftUI
import UIKit
import WidgetKit

private let tallyURL = URL(string: "tally://home")!
private let accent = Color(red: 15 / 255, green: 120 / 255, blue: 153 / 255)

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
  @Environment(\.widgetContentMargins) private var contentMargins
  @Environment(\.locale) private var locale
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @ScaledMetric(relativeTo: .headline) private var titleFontSize = 17.0
  @ScaledMetric(relativeTo: .largeTitle) private var countFontSize = 34.0
  @ScaledMetric(relativeTo: .largeTitle) private var lockScreenCountFontSize = 40.0

  var body: some View {
    Group {
      if let counter = entry.counter, let owner = entry.owner {
        Group {
          if family == .systemMedium {
            GeometryReader { geometry in
              HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                  nameAndMetric(counter)
                  Spacer(minLength: 0)
                  TallyMark().frame(width: 22, height: 22).accessibilityHidden(true)
                }
                .frame(width: geometry.size.width / 4, alignment: .leading)
                controls(counter, owner: owner)
                  .frame(maxWidth: .infinity, maxHeight: .infinity)
              }
            }
          } else if family == .accessoryRectangular {
            header(counter)
          } else {
            smallCounter(counter, owner: owner)
          }
        }
        .privacySensitive()
      } else {
        VStack(spacing: 8) {
          TallyMark().frame(width: 32, height: 32)
          Text("Open Tally").font(.headline)
          if family != .accessoryRectangular {
            Text("Add or choose a counter.").font(.caption).multilineTextAlignment(.center)
          }
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(
      family == .systemSmall
        ? EdgeInsets(top: 16, leading: 18, bottom: 12, trailing: 12) : contentMargins
    )
    .dynamicTypeSize(family == .systemSmall ? .large : dynamicTypeSize)
    .foregroundStyle(family == .accessoryRectangular ? Color.primary : .white)
    .widgetURL(tallyURL)
    .containerBackground(
      family == .accessoryRectangular
        ? Color.clear : Color(red: 37 / 255, green: 41 / 255, blue: 46 / 255), for: .widget)
  }

  private func smallCounter(_ counter: WidgetCounter, owner: String) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(counter.title)
        .font(.system(size: 24, weight: .semibold))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      HStack(alignment: .bottom, spacing: 8) {
        VStack(alignment: .leading, spacing: 4) {
          if let metric = counter.metric, !metric.isEmpty {
            Text(metric)
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(Color(white: 181 / 255))
              .lineLimit(1)
          }
          Spacer(minLength: 0)
          value(counter)
            .fixedSize(horizontal: false, vertical: true)
            .frame(height: 56, alignment: .bottom)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 2)
            .offset(x: 2)
        }
        VStack(spacing: 10) {
          control(counter, owner: owner, increase: true)
          control(counter, owner: owner, increase: false)
        }
        .frame(width: 56)
        .frame(maxHeight: .infinity, alignment: .bottom)
      }
    }
  }

  private func nameAndMetric(_ counter: WidgetCounter) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      counterText(
        counter.title,
        font: .systemFont(ofSize: titleFontSize, weight: .semibold), minimumScale: 0.85,
        alignLeading: family == .systemSmall
      )
      if let metric = counter.metric, !metric.isEmpty {
        Text(metric).font(.caption).foregroundStyle(.secondary).lineLimit(1)
      }
    }
  }

  private func header(_ counter: WidgetCounter) -> some View {
    let hasMetric = !(counter.metric ?? "").isEmpty
    return HStack(alignment: hasMetric ? .counterTextTop : .counterTextCenter, spacing: 8) {
      nameAndMetric(counter).frame(maxWidth: .infinity, alignment: .leading)
      value(counter)
    }
    .padding(.horizontal, 8)
  }

  private func value(_ counter: WidgetCounter) -> some View {
    let size =
      family == .systemSmall
      ? 64 : (family == .accessoryRectangular ? lockScreenCountFontSize : countFontSize)
    let baseFont = UIFont.monospacedDigitSystemFont(
      ofSize: size, weight: family == .systemSmall ? .semibold : .bold)
    let font = UIFont(
      descriptor: baseFont.fontDescriptor.withDesign(.rounded) ?? baseFont.fontDescriptor,
      size: size)
    let text = counter.count.formatted(.number.precision(.fractionLength(0...6)).locale(locale))
    return counterText(
      text, font: font, minimumScale: family == .systemSmall ? 0.1 : 0.35,
      alignLeading: family == .systemSmall
    )
    .contentTransition(.numericText(value: counter.count))
  }

  private func controls(_ counter: WidgetCounter, owner: String) -> some View {
    HStack(spacing: 0) {
      Spacer(minLength: 8)
      control(counter, owner: owner, increase: false)
      Spacer(minLength: 8)
      if family == .systemMedium {
        value(counter)
        Spacer(minLength: 8)
      }
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
