import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import SwiftUI
import UIKit

actor ArtworkPaletteExtractor {
    static let shared = ArtworkPaletteExtractor()

    private let ciContext = CIContext(options: [.workingColorSpace: NSNull()])
    private let cache = NSCache<NSString, ThemeBox>()

    func theme(for artworkURL: URL) async -> NowPlayingTheme? {
        let key = artworkURL.absoluteString as NSString
        if let cached = cache.object(forKey: key) {
            return cached.value
        }

        var request = URLRequest(url: artworkURL)
        request.timeoutInterval = 5

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
                return nil
            }

            guard let image = UIImage(data: data), let base = averageColor(from: image) else {
                return nil
            }

            let accent = base.saturated(multiplier: 1.45).brightened(multiplier: 1.18)
            let warmer = accent.shiftHue(by: 0.06).saturated(multiplier: 1.1)
            let deeper = accent.brightened(multiplier: 0.40)
            let bottom = accent.shiftHue(by: -0.08).brightened(multiplier: 0.18)

            let theme = NowPlayingTheme(
                backgroundTop: Color(uiColor: deeper.withAlphaComponent(0.95)),
                backgroundBottom: Color(uiColor: bottom.withAlphaComponent(1.0)),
                ringOuter: Color(uiColor: accent.withAlphaComponent(0.42)),
                ringTrack: Color(uiColor: accent.withAlphaComponent(0.95)),
                progressStart: Color(uiColor: warmer.withAlphaComponent(1.0)),
                progressEnd: Color(uiColor: accent.withAlphaComponent(1.0)),
                buttonStart: Color(uiColor: warmer.withAlphaComponent(1.0)),
                buttonEnd: Color(uiColor: accent.withAlphaComponent(1.0)),
                glow: Color(uiColor: accent.withAlphaComponent(0.9))
            )

            cache.setObject(ThemeBox(theme), forKey: key)
            return theme
        } catch {
            return nil
        }
    }

    private func averageColor(from image: UIImage) -> UIColor? {
        guard let input = CIImage(image: image) else { return nil }

        let filter = CIFilter.areaAverage()
        filter.inputImage = input
        filter.extent = input.extent

        guard let output = filter.outputImage else { return nil }

        var bitmap = [UInt8](repeating: 0, count: 4)
        ciContext.render(
            output,
            toBitmap: &bitmap,
            rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: nil
        )

        return UIColor(
            red: CGFloat(bitmap[0]) / 255.0,
            green: CGFloat(bitmap[1]) / 255.0,
            blue: CGFloat(bitmap[2]) / 255.0,
            alpha: 1.0
        )
    }
}

private final class ThemeBox {
    let value: NowPlayingTheme

    init(_ value: NowPlayingTheme) {
        self.value = value
    }
}

private extension UIColor {
    func saturated(multiplier: CGFloat) -> UIColor {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0

        guard getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return self
        }

        return UIColor(
            hue: hue,
            saturation: min(max(0.1, saturation * multiplier), 1.0),
            brightness: brightness,
            alpha: alpha
        )
    }

    func brightened(multiplier: CGFloat) -> UIColor {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0

        guard getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return self
        }

        return UIColor(
            hue: hue,
            saturation: saturation,
            brightness: min(max(0.08, brightness * multiplier), 1.0),
            alpha: alpha
        )
    }

    func shiftHue(by offset: CGFloat) -> UIColor {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0

        guard getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return self
        }

        var nextHue = hue + offset
        while nextHue < 0 { nextHue += 1 }
        while nextHue > 1 { nextHue -= 1 }

        return UIColor(
            hue: nextHue,
            saturation: saturation,
            brightness: brightness,
            alpha: alpha
        )
    }
}
