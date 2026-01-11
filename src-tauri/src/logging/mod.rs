//! Structured logging for Panager
//!
//! This module sets up tracing-based logging with configurable levels and outputs.

use tracing_subscriber::{
    fmt,
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
};

/// Initialize the logging system
///
/// This sets up tracing with:
/// - Environment-based filtering via RUST_LOG env var
/// - Default level of INFO in release builds, DEBUG in debug builds
/// - Console output with timestamps and target information
///
/// # Example
/// ```ignore
/// use panager_lib::logging;
/// logging::init();
/// tracing::info!("Application started");
/// ```
pub fn init() {
    // Default log level based on build type
    let default_level = if cfg!(debug_assertions) {
        "panager=debug,info"
    } else {
        "panager=info,warn"
    };

    // Allow override via RUST_LOG environment variable
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(default_level));

    // Build the subscriber with formatting layer
    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .with_target(true)
                .with_thread_ids(false)
                .with_file(true)
                .with_line_number(true)
                .compact()
        )
        .init();
}

/// Initialize logging for tests
///
/// Similar to `init()` but with a test-friendly configuration.
/// Uses try_init() to avoid panicking if called multiple times.
#[cfg(test)]
pub fn init_test() {
    let _ = tracing_subscriber::registry()
        .with(EnvFilter::new("debug"))
        .with(fmt::layer().with_test_writer())
        .try_init();
}

/// Macro for creating a span with common fields
///
/// This is useful for wrapping command handlers or service operations.
#[macro_export]
macro_rules! operation_span {
    ($name:expr) => {
        tracing::info_span!($name)
    };
    ($name:expr, $($field:tt)*) => {
        tracing::info_span!($name, $($field)*)
    };
}

/// Re-export commonly used tracing macros for convenience
pub use tracing::{debug, error, info, trace, warn};
pub use tracing::{debug_span, error_span, info_span, trace_span, warn_span};
pub use tracing::instrument;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_does_not_panic() {
        // Just verify that init_test doesn't panic
        init_test();
    }

    #[test]
    fn test_logging_macros() {
        init_test();

        // These should all work without panicking
        trace!("trace message");
        debug!("debug message");
        info!("info message");
        warn!("warn message");
        error!("error message");
    }
}
