import CoreText
import SwiftUI
import UIKit

private enum CounterTextTop: AlignmentID {
  static func defaultValue(in dimensions: ViewDimensions) -> CGFloat { dimensions[.top] }
}

private enum CounterTextCenter: AlignmentID {
  static func defaultValue(in dimensions: ViewDimensions) -> CGFloat {
    dimensions[VerticalAlignment.center]
  }
}

extension VerticalAlignment {
  static let counterTextTop = VerticalAlignment(CounterTextTop.self)
  static let counterTextCenter = VerticalAlignment(CounterTextCenter.self)
}

func counterText(_ text: String, font: UIFont, minimumScale: CGFloat, alignLeading: Bool)
  -> some View
{
  let line = CTLineCreateWithAttributedString(
    NSAttributedString(string: text, attributes: [.font: font]))
  let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
  let top = bounds.isEmpty ? font.capHeight : bounds.maxY
  let width = (text as NSString).size(withAttributes: [.font: font]).width
  return Text(text)
    .font(Font(font))
    .lineLimit(1)
    .minimumScaleFactor(minimumScale)
    // Align visible glyphs, not the font's empty margins.
    .alignmentGuide(.leading) { dimensions in
      let scale = max(minimumScale, min(1, dimensions.width / max(width, 1)))
      return dimensions[.leading] + (alignLeading ? bounds.minX * scale : 0)
    }
    .alignmentGuide(.counterTextTop) { dimensions in
      let scale = max(minimumScale, min(1, dimensions.width / max(width, 1)))
      return dimensions[.firstTextBaseline] - top * scale
    }
    .alignmentGuide(.counterTextCenter) { dimensions in
      let scale = max(minimumScale, min(1, dimensions.width / max(width, 1)))
      return dimensions[.firstTextBaseline] - bounds.midY * scale
    }
    .alignmentGuide(.bottom) { dimensions in
      let scale = max(minimumScale, min(1, dimensions.width / max(width, 1)))
      return dimensions[.lastTextBaseline] - bounds.minY * scale
    }
}
