import Testing
@testable import melodia

struct melodiaTests {

    @Test func trackDurationFormatterUsesMinuteSecondFormat() {
        #expect(MelodiaFormat.trackDuration(245) == "4:05")
        #expect(MelodiaFormat.trackDuration(nil) == "--:--")
    }

    @Test func serverURLNormalizationAddsDefaultSchemeAndTrimsSlash() {
        let normalized = MelodiaAppModel.normalizedServerURLString(from: "192.168.0.50:4872/")
        #expect(normalized == "http://192.168.0.50:4872")
    }

    @Test func serverURLNormalizationRejectsInvalidValues() {
        #expect(MelodiaAppModel.normalizedServerURLString(from: "") == nil)
        #expect(MelodiaAppModel.normalizedServerURLString(from: "ftp://example.com") == nil)
        #expect(MelodiaAppModel.normalizedServerURLString(from: "http://") == nil)
    }
}
