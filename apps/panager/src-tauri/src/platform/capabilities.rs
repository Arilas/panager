//! Platform capability detection
//!
//! Provides runtime feature detection for platform-specific functionality,
//! particularly macOS version-dependent features like Liquid Glass.

/// Runtime capability checks for macOS version-dependent features
#[cfg(target_os = "macos")]
pub mod macos {
    use once_cell::sync::Lazy;
    use std::process::Command;

    /// Cached macOS version (major, minor)
    static MACOS_VERSION: Lazy<Option<(u32, u32)>> = Lazy::new(parse_macos_version);

    /// Parse macOS version from sw_vers command
    fn parse_macos_version() -> Option<(u32, u32)> {
        let output = Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let version_str = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = version_str.trim().split('.').collect();

        if parts.len() >= 2 {
            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            Some((major, minor))
        } else if !parts.is_empty() {
            // macOS 26+ might just be "26"
            let major = parts[0].parse().ok()?;
            Some((major, 0))
        } else {
            None
        }
    }

    /// Check if running on at least the specified macOS version
    pub fn check_macos_version(min_major: u32, min_minor: u32) -> bool {
        matches!(*MACOS_VERSION, Some((major, minor)) if (major, minor) >= (min_major, min_minor))
    }

    /// Whether backdrop filter (vibrancy) is supported (macOS 10.14+)
    pub fn is_backdrop_filter_supported() -> bool {
        check_macos_version(10, 14)
    }

    /// Whether full Liquid Glass effects are supported (macOS 26+)
    pub fn is_liquid_glass_supported() -> bool {
        matches!(*MACOS_VERSION, Some((major, _)) if major >= 26)
    }

    /// Get macOS version as a string
    pub fn get_version_string() -> Option<String> {
        MACOS_VERSION.map(|(major, minor)| format!("{}.{}", major, minor))
    }
}
