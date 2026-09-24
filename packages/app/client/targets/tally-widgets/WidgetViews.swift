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
  @ScaledMetric(relativeTo: .largeTitle) private var lockScreenCountFontSize = 42.0

  var body: some View {
    Group {
      if let counter = entry.counter, let owner = entry.owner {
        Group {
          if family == .systemMedium {
            GeometryReader { geometry in
              VStack(spacing: 0) {
                HStack(alignment: .counterTextTop, spacing: 8) {
                  nameAndMetric(counter)
                    .frame(width: geometry.size.width / 4, alignment: .leading)
                  Spacer(minLength: 0)
                  incrementLabel(counter)
                }
                Spacer(minLength: 4)
                controls(counter, owner: owner)
                  .frame(width: geometry.size.width * 3 / 4)
                Spacer(minLength: 4)
                TallyMark().frame(width: 22, height: 22).accessibilityHidden(true)
                  .frame(maxWidth: .infinity, alignment: .leading)
              }
              .frame(width: geometry.size.width, height: geometry.size.height)
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
    GeometryReader { geometry in
      let buttonSize = min(60, (geometry.size.height - 24) / 2)
      HStack(spacing: 8) {
        VStack(spacing: 0) {
          nameAndMetric(counter).frame(maxWidth: .infinity, alignment: .leading)
          Spacer(minLength: 4)
          value(counter).frame(maxWidth: .infinity)
          Spacer(minLength: 4)
          incrementLabel(counter).frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(
          width: geometry.size.width - buttonSize - 8, height: geometry.size.height,
          alignment: .leading)
        VStack(spacing: 0) {
          Spacer(minLength: 8)
          control(counter, owner: owner, increase: true)
            .frame(width: buttonSize, height: buttonSize)
          Spacer(minLength: 8)
          control(counter, owner: owner, increase: false)
            .frame(width: buttonSize, height: buttonSize)
          Spacer(minLength: 8)
        }
        .frame(width: buttonSize, height: geometry.size.height)
      }
    }
  }

  private func nameAndMetric(_ counter: WidgetCounter) -> some View {
    let nameOnly = family == .accessoryRectangular && (counter.metric?.isEmpty ?? true)
    let nameSize =
      family == .accessoryRectangular
      ? titleFontSize * (nameOnly ? 1.5 : 1.2) : titleFontSize
    return VStack(alignment: .leading, spacing: 2) {
      counterText(
        counter.title,
        font: .systemFont(ofSize: family == .systemSmall ? 24 : nameSize, weight: .semibold),
        minimumScale: family == .systemSmall ? 0.6 : (family == .accessoryRectangular ? 0.4 : 0.85),
        alignLeading: family == .systemSmall
      )
      if let metric = counter.metric, !metric.isEmpty {
        if family == .systemSmall {
          Text(metric)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color(white: 181 / 255))
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        } else {
          Text(metric)
            .font(family == .accessoryRectangular ? .subheadline : .caption)
            .foregroundStyle(.secondary).lineLimit(1)
            .minimumScaleFactor(family == .accessoryRectangular ? 0.5 : 1)
        }
      }
    }
  }

  private func header(_ counter: WidgetCounter) -> some View {
    GeometryReader { geometry in
      HStack(alignment: .counterTextCenter, spacing: 8) {
        nameAndMetric(counter)
          .frame(maxWidth: .infinity, alignment: .leading)
          .alignmentGuide(.counterTextCenter) { $0[VerticalAlignment.center] }
        value(counter)
          .frame(maxWidth: geometry.size.width * 0.62)
          .fixedSize(horizontal: true, vertical: false)
          .layoutPriority(1)
      }
      .frame(width: geometry.size.width, height: geometry.size.height, alignment: .leading)
    }
    .padding(.horizontal, 8)
  }

  private func incrementLabel(_ counter: WidgetCounter) -> some View {
    counterText(
      "± \(counter.increment.formatted(.number.precision(.fractionLength(0...6)).locale(locale)))",
      font: .monospacedDigitSystemFont(ofSize: 16, weight: .semibold), minimumScale: 0.6,
      alignLeading: false
    )
    .foregroundStyle(Color(red: 112 / 255, green: 200 / 255, blue: 227 / 255))
    .accessibilityLabel("Increment \(counter.increment.formatted())")
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
