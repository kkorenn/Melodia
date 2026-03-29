import SwiftUI

struct NowPlayingTheme: Equatable {
    let backgroundTop: Color
    let backgroundBottom: Color
    let ringOuter: Color
    let ringTrack: Color
    let progressStart: Color
    let progressEnd: Color
    let buttonStart: Color
    let buttonEnd: Color
    let glow: Color

    static let `default` = NowPlayingTheme(
        backgroundTop: Color(red: 0.02, green: 0.02, blue: 0.08),
        backgroundBottom: Color(red: 0.12, green: 0.02, blue: 0.14),
        ringOuter: Color(red: 0.65, green: 0.15, blue: 0.26),
        ringTrack: Color(red: 0.96, green: 0.22, blue: 0.30),
        progressStart: Color.orange,
        progressEnd: Color.red,
        buttonStart: Color(red: 1.00, green: 0.34, blue: 0.18),
        buttonEnd: Color(red: 0.93, green: 0.18, blue: 0.28),
        glow: Color(red: 1.00, green: 0.33, blue: 0.24)
    )
}
