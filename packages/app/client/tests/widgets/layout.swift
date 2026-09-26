import SwiftUI
import UIKit
import WidgetKit

private struct Pixels {
  let width: Int
  let height: Int
  let bytes: [UInt8]

  init(_ image: CGImage) {
    width = image.width
    height = image.height
    var data = [UInt8](repeating: 0, count: width * height * 4)
    let context = CGContext(
      data: &data, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    )!
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    bytes = data
  }

  // Return visible bands in points. These checks measure glyphs, not font line boxes.
  func bands(
    along axis: Axis = .vertical, xRange: Range<Int>? = nil,
    matching: (UInt8, UInt8, UInt8) -> Bool
  ) -> [CGRect] {
    var result: [CGRect] = []
    var band: CGRect?
    for position in 0..<(axis == .vertical ? height : width) {
      let matches = (axis == .vertical ? xRange ?? 0..<width : 0..<height).filter { cross in
        let x = axis == .vertical ? cross : position
        let y = axis == .vertical ? position : cross
        let index = (y * width + x) * 4
        return matching(bytes[index], bytes[index + 1], bytes[index + 2])
      }
      if let first = matches.first, let last = matches.last {
        let row =
          axis == .vertical
          ? CGRect(
            x: Double(first) / 3, y: Double(position) / 3,
            width: Double(last - first + 1) / 3, height: 1.0 / 3)
          : CGRect(
            x: Double(position) / 3, y: Double(first) / 3,
            width: 1.0 / 3, height: Double(last - first + 1) / 3)
        band = band.map { $0.union(row) } ?? row
      } else if let complete = band {
        result.append(complete)
        band = nil
      }
    }
    if let band { result.append(band) }
    return result
  }
}

@main
struct WidgetLayoutChecks {
  @MainActor static func main() throws {
    func render(
      _ family: WidgetFamily, title: String = "Water", metric: String?, count: Double = 0,
      width: Double, height: Double
    ) -> Pixels {
      let view = CounterWidgetView(
        entry: CounterEntry(
          date: .now, owner: "preview",
          counter:
            WidgetCounter(
              id: "preview", title: title, count: count, increment: 16.9, metric: metric)),
        family: family
      )
      .environment(\.colorScheme, .dark)
      .frame(width: width, height: height)
      .background(Color(red: 37 / 255, green: 41 / 255, blue: 46 / 255))
      let renderer = ImageRenderer(content: view)
      renderer.scale = 3
      return Pixels(renderer.uiImage!.cgImage!)
    }
    let neutral: (UInt8, UInt8, UInt8) -> Bool = {
      $0 > 100 && abs(Int($0) - Int($1)) < 6 && abs(Int($1) - Int($2)) < 6
    }
    let blue: (UInt8, UInt8, UInt8) -> Bool = {
      $0 < 40 && $1 > 100 && $1 < 150 && $2 > 130 && $2 < 180
    }
    let cyan: (UInt8, UInt8, UInt8) -> Bool = { $0 > 80 && Int($1) - Int($0) > 60 && $2 > 190 }

    func lockScreenColumns(_ pixels: Pixels) -> (labels: CGRect, count: CGRect) {
      let columns = pixels.bands(along: .horizontal, matching: neutral)
      // The label/count gap is wider than the gaps between these glyphs.
      let split = (1..<columns.count).max {
        columns[$0].minX - columns[$0 - 1].maxX < columns[$1].minX - columns[$1 - 1].maxX
      }!
      return (
        columns[..<split].reduce(CGRect.null) { $0.union($1) },
        columns[split...].reduce(CGRect.null) { $0.union($1) }
      )
    }

    // Missing metrics must move the count up, not leave an empty metric row.
    for width in [158.0, 182.0, 188.0] {
      for metric in [nil, "fl-oz"] as [String?] {
        for name in ["Pushups", "Daily water intake"] {
          let pixels = render(
            .systemSmall, title: name, metric: metric, width: width, height: width)
          let buttons = pixels.bands(matching: blue)
          precondition(buttons.count == 2, "Small widget must show two separate buttons")
          let gaps = [
            buttons[0].minY - 16, buttons[1].minY - buttons[0].maxY,
            width - 12 - buttons[1].maxY,
          ]
          precondition(
            gaps.min()! >= 8 && gaps.max()! - gaps.min()! <= 1,
            "Buttons must have equal space above, between, and below: \(gaps)")
          let left = 0..<Int((buttons[0].minX - 6) * 3)
          let text = pixels.bands(xRange: left, matching: neutral)
          precondition(text.count == (metric == nil ? 2 : 3), "Name or metric wrapped: \(text)")
          let count = text.last!
          let increment = pixels.bands(xRange: left, matching: cyan).first!
          let center = (text[text.count - 2].maxY + increment.minY) / 2
          precondition(
            abs(count.midY - center) <= 2,
            "Count must center between the header and increment: \(count.midY), \(center)")
          precondition(
            buttons.allSatisfy { $0.width >= 44 && $0.width <= 60 && $0.maxX <= width - 10 },
            "Button target must stay compact and inside the widget: \(buttons)")
        }
      }
    }

    for value in [0.0, 16.9] {
      var metricNameHeight: CGFloat = 0
      for metric in ["fl-oz", nil] as [String?] {
        let pixels = render(
          .accessoryRectangular, metric: metric, count: value, width: 172, height: 76)
        let (labels, count) = lockScreenColumns(pixels)
        precondition(
          labels.minX >= 8 && labels.minX <= 11 && count.maxX >= 158 && count.maxX <= 164,
          "Lock Screen labels and count must sit at opposite insets: \(labels), \(count)")
        precondition(
          abs(count.midY - labels.midY) <= 2,
          "Lock Screen labels and count must center (metric: \(metric ?? "none")): \(count), \(labels)"
        )
        if metric != nil {
          let text = pixels.bands(xRange: 0..<Int(labels.maxX * 3), matching: neutral)
          metricNameHeight = text.first!.height
          precondition(
            metricNameHeight >= 14 && text.last!.height >= 10,
            "Lock Screen name and metric must use the larger label sizes: \(text)")
        } else if value == 0 {
          precondition(
            labels.height > metricNameHeight,
            "A Lock Screen name without a metric must be larger when space permits: \(labels.height), \(metricNameHeight)"
          )
        }
      }
    }

    // These narrow layouts need more than a 20% font reduction to keep their labels whole.
    for (name, metric, count, width) in [
      ("Pushups", nil, 14.0, 140.0),
      ("Water", "16 fl oz", 16.9, 140.0),
      ("Daily water", "16 oz bottle", 1234.5, 172.0),
    ] as [(String, String?, Double, Double)] {
      func labelLines(width: Double) -> [CGRect] {
        let pixels = render(
          .accessoryRectangular, title: name, metric: metric, count: count, width: width, height: 76
        )
        let labels = lockScreenColumns(pixels).labels
        return pixels.bands(xRange: 0..<Int(ceil(labels.maxX * 3)), matching: neutral)
      }
      let full = labelLines(width: 300)
      let fitted = labelLines(width: width)
      precondition(
        fitted.count == full.count, "Lock Screen labels must keep their lines when fitting")
      for (original, scaled) in zip(full, fitted) {
        precondition(
          scaled.height < original.height * 0.8,
          "Lock Screen labels must shrink to fit narrow spaces (\(name), \(metric ?? "none")): \(original), \(scaled)"
        )
      }
    }

    let longCount = render(
      .accessoryRectangular, title: "Daily water", metric: "16 oz bottle", count: 1234.5,
      width: 172, height: 76)
    precondition(
      longCount.bands(xRange: 0..<180, matching: neutral).count == 2,
      "A long count must not remove the Lock Screen name or metric")

    for (width, height) in [(338.0, 158.0), (364.0, 170.0)] {
      for metric in [nil, "fl-oz"] as [String?] {
        let medium = render(
          .systemMedium, title: "Pushups", metric: metric, width: width, height: height)
        let labels = medium.bands(xRange: 0..<Int(width / 4 * 3), matching: neutral)
        let title = labels.first!
        let increment = medium.bands(matching: cyan).first!
        precondition(
          abs(title.minY - increment.minY) <= 0.5,
          "Medium widget title and increment must align at the top: \(title), \(increment)")
        let controls = medium.bands(matching: blue).first!
        precondition(
          abs(controls.midX - width / 2) <= 0.5,
          "Medium controls must center horizontally in the widget: \(controls)")
        let headerBottom = labels[labels.count - 2].maxY
        let logoTop = labels.last!.minY
        precondition(
          abs(controls.midY - (headerBottom + logoTop) / 2) <= 2,
          "Medium controls must center between the header and logo (metric: \(metric ?? "none")): \(controls), \(labels)"
        )
      }
    }
    print(
      "Widget layout checks passed: evenly spaced buttons, one-line names, count placement, text alignment."
    )
  }
}
