# Cross-Platform Support Investigation Report

## Panager - Project Manager for Developers

**Current State:** macOS-focused implementation
**Target Platforms:** Linux (native), Windows (native), Windows with WSL
**Investigation Date:** January 2026

---

## Executive Summary

Panager is built on **Tauri 2** (Rust + React), which provides excellent cross-platform foundations. However, the current implementation has significant macOS-specific code that needs platform-specific alternatives for Linux and Windows.

| Effort Area | Linux | Windows (Native) | Windows + WSL |
|-------------|-------|------------------|---------------|
| Editor Detection | **Easy** | **Medium** | **Medium** |
| Editor Launching | **Easy** | **Medium** | **Complex** |
| SSH Config | **Works** | **Medium** | **Complex** |
| Git Integration | **Works** | **Works** | **Medium** |
| UI/Window Behavior | **Easy** | **Easy** | **Easy** |
| Path Handling | **Works** | **Medium** | **Complex** |

---

## 1. LINUX PLATFORM

### Current Status: **80% Compatible**

Linux shares most code paths with macOS due to UNIX foundations. Main gaps are visual effects and editor detection.

### 1.1 Editor Detection (`src-tauri/src/commands/editors.rs:54-77`)
**Difficulty: Easy**

**Current Problem:** Only checks `/Applications/` (macOS path)

**Solution:**
```rust
#[cfg(target_os = "linux")]
{
    use std::path::Path;

    // Check common Linux locations
    let linux_paths = [
        // Flatpak
        "/var/lib/flatpak/exports/bin/",
        "$HOME/.local/share/flatpak/exports/bin/",
        // Snap
        "/snap/bin/",
        // AppImage (user's home)
        "$HOME/Applications/",
        // System-wide
        "/usr/bin/",
        "/usr/local/bin/",
        "/opt/",
    ];

    // Check .desktop files in /usr/share/applications/
    // Parse XDG desktop entries for Exec= commands
}
```

**Plan:**
1. Add `#[cfg(target_os = "linux")]` block after macOS block
2. Check XDG desktop entries in `/usr/share/applications/`
3. Parse Flatpak, Snap, and AppImage locations
4. Check `$PATH` for editor commands (already done via `which` crate)

### 1.2 Window Vibrancy (`src-tauri/src/lib.rs:44-53`)
**Difficulty: Easy**

**Current Problem:** macOS-only vibrancy effect

**Solution:** Skip on Linux (already handled with `#[cfg(target_os = "macos")]`)

**Optional Enhancement:**
- Consider KDE Plasma blur effects via D-Bus
- GTK4 has some transparency support
- Most users won't notice/care about this feature

### 1.3 Application Menu (`src-tauri/src/lib.rs:67-178`)
**Difficulty: Easy**

**Current Problem:** macOS-specific menu bar

**Solution:**
- Linux apps typically don't have global menu bars
- System tray already works (lines 180-216)
- Add optional Unity/AppIndicator support for Ubuntu

**Plan:**
1. Keep current behavior (no menu bar on Linux) ✅
2. Ensure system tray works properly with various DEs (GNOME, KDE, XFCE)
3. Add keyboard shortcuts that work without menu

### 1.4 SSH Config Permissions (`src-tauri/src/services/ssh_config.rs:90-148`)
**Difficulty: Works Already**

The `#[cfg(unix)]` blocks already handle both macOS and Linux:
```rust
#[cfg(unix)]
{
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&ssh_dir, fs::Permissions::from_mode(0o700))
}
```

### 1.5 File Paths
**Difficulty: Works Already**

The `directories` crate handles XDG paths correctly:
- Config: `~/.config/panager/`
- Data: `~/.local/share/panager/`
- Cache: `~/.cache/panager/`

### Linux Implementation Plan

| Task | Priority | Effort |
|------|----------|--------|
| Add Linux editor detection paths | High | 2-4 hours |
| Test system tray on GNOME/KDE/XFCE | High | 2-3 hours |
| Test global shortcuts | Medium | 1-2 hours |
| Add Flatpak/Snap editor detection | Medium | 2-3 hours |
| Optional: KDE blur support | Low | 4-6 hours |

**Total Estimated Effort: 1-2 days**

---

## 2. WINDOWS PLATFORM (Native)

### Current Status: **60% Compatible**

Windows requires more changes due to different filesystem conventions, registry-based app detection, and different shell behavior.

### 2.1 Editor Detection (`src-tauri/src/commands/editors.rs:54-77`)
**Difficulty: Medium**

**Current Problem:** No Windows detection logic

**Solution:**
```rust
#[cfg(target_os = "windows")]
{
    use winreg::RegKey;
    use winreg::enums::*;

    // Check Windows registry for installed apps
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Common paths
    let windows_paths = [
        // VS Code
        r"C:\Users\{user}\AppData\Local\Programs\Microsoft VS Code\",
        r"C:\Program Files\Microsoft VS Code\",
        // Cursor
        r"C:\Users\{user}\AppData\Local\Programs\cursor\",
        // JetBrains Toolbox
        r"C:\Users\{user}\AppData\Local\JetBrains\Toolbox\apps\",
        // Sublime Text
        r"C:\Program Files\Sublime Text\",
    ];

    // Check PATH environment variable
    // Check App Paths registry keys
}
```

**Plan:**
1. Add `winreg` crate dependency for registry access
2. Check common installation paths
3. Check `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths`
4. Check user's PATH environment variable
5. Handle both 32-bit and 64-bit Program Files

### 2.2 Editor Launching (`src-tauri/src/commands/editors.rs:181-235`)
**Difficulty: Medium**

**Current Problem:** macOS `open -a` fallback doesn't exist on Windows

**Solution:**
```rust
#[cfg(target_os = "windows")]
{
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Try direct command
    let result = Command::new(&editor_command)
        .arg(&project_path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    // Fallback: Use 'start' command or ShellExecute
    if result.is_err() {
        Command::new("cmd")
            .args(["/C", "start", "", &editor_path, &project_path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
    }
}
```

### 2.3 SSH Config Permissions (`src-tauri/src/services/ssh_config.rs:90-148`)
**Difficulty: Medium**

**Current Problem:** Unix file permissions don't apply to Windows

**Solution:**
```rust
#[cfg(windows)]
{
    // Windows SSH expects specific NTFS permissions
    // Option 1: Use icacls command
    Command::new("icacls")
        .args([&ssh_dir, "/inheritance:r", "/grant:r", &format!("{}:F", username)])
        .output();

    // Option 2: Use windows-acl crate for proper ACL management
    use windows_acl::acl::ACL;
    // Set permissions programmatically
}
```

**Plan:**
1. Add Windows-specific permission handling
2. Use `icacls` command or `windows-acl` crate
3. Ensure SSH keys have correct owner-only permissions
4. Test with Windows OpenSSH client

### 2.4 Path Handling
**Difficulty: Medium**

**Issues:**
- Windows uses backslashes (`\`) vs forward slashes (`/`)
- Different path roots (`C:\` vs `/`)
- Case-insensitive filesystem

**Solution:**
```rust
// Use PathBuf consistently (already done mostly)
use std::path::PathBuf;

// Normalize paths for display
fn normalize_path_for_display(path: &str) -> String {
    #[cfg(windows)]
    { path.replace("/", "\\") }
    #[cfg(not(windows))]
    { path.to_string() }
}
```

**Current Issue in `src-tauri/src/services/git_config.rs:419-422`:**
```rust
// This uses forward slashes which may not work on Windows
let folder = if scope_folder.ends_with('/') {
    scope_folder
} else {
    format!("{}/", scope_folder)
};
```

### 2.5 Home Directory
**Difficulty: Works Already**

The `home` crate handles this correctly:
- Windows: `C:\Users\{username}`
- The `directories` crate maps to:
  - Config: `C:\Users\{user}\AppData\Roaming\panager\`
  - Data: `C:\Users\{user}\AppData\Local\panager\`

### 2.6 Window Behavior (`src-tauri/src/lib.rs:233-237`)
**Difficulty: Easy**

**Current Problem:** macOS hide-on-close behavior

**Solution:** Already handled with `#[cfg(target_os = "macos")]`. Windows will get normal close behavior.

**Optional Enhancement:**
- Minimize to system tray instead of closing (common Windows pattern)
- Add setting to choose behavior

### 2.7 Titlebar (`src-tauri/tauri.conf.json`)
**Difficulty: Easy**

Current config:
```json
"titleBarStyle": "Overlay"
```

Windows supports overlay titlebars in Tauri 2, but may need testing.

### Windows Implementation Plan

| Task | Priority | Effort |
|------|----------|--------|
| Add Windows editor detection (registry + paths) | High | 4-6 hours |
| Add Windows editor launching fallback | High | 2-3 hours |
| Implement Windows SSH permissions (icacls) | High | 3-4 hours |
| Normalize path separators throughout codebase | High | 3-4 hours |
| Test titlebar overlay on Windows | Medium | 1-2 hours |
| Add minimize-to-tray option | Low | 2-3 hours |
| Add Windows installer (MSI/MSIX) | Medium | 2-4 hours |

**Total Estimated Effort: 3-4 days**

---

## 3. WINDOWS WITH WSL

### Current Status: **40% Compatible**

WSL adds significant complexity because projects may exist in both Windows and Linux filesystems, and users may want to use either Windows or Linux editors.

### 3.1 Dual Filesystem Paths
**Difficulty: Complex**

**Challenge:**
- WSL path: `/home/user/projects/`
- Windows equivalent: `\\wsl$\Ubuntu\home\user\projects\`
- Windows path: `C:\Users\user\projects\`
- WSL equivalent: `/mnt/c/Users/user/projects/`

**Solution:**
```rust
struct CrossPlatformPath {
    original: String,
    windows_path: Option<String>,
    wsl_path: Option<String>,
}

fn convert_wsl_to_windows(path: &str) -> Option<String> {
    if path.starts_with("/mnt/") {
        // /mnt/c/Users/... -> C:\Users\...
        let parts: Vec<&str> = path[5..].splitn(2, '/').collect();
        if parts.len() == 2 {
            return Some(format!("{}:\\{}", parts[0].to_uppercase(), parts[1].replace("/", "\\")));
        }
    } else if path.starts_with("/home/") || path.starts_with("/") {
        // WSL native path -> \\wsl$\{distro}\...
        return Some(format!("\\\\wsl$\\Ubuntu{}", path.replace("/", "\\")));
    }
    None
}

fn convert_windows_to_wsl(path: &str) -> Option<String> {
    // C:\Users\... -> /mnt/c/Users/...
    if path.chars().nth(1) == Some(':') {
        let drive = path.chars().next()?.to_lowercase().next()?;
        return Some(format!("/mnt/{}/{}", drive, path[3..].replace("\\", "/")));
    }
    // \\wsl$\Ubuntu\... -> /...
    if path.starts_with("\\\\wsl$\\") {
        let after_distro = path.find('\\').and_then(|i| path[i+1..].find('\\'))?;
        // ... extract path
    }
    None
}
```

### 3.2 Editor Detection in WSL Context
**Difficulty: Complex**

**Scenarios:**
1. Running Panager in Windows, opening WSL projects in Windows editors
2. Running Panager in Windows, opening WSL projects in WSL editors
3. Running Panager in WSL, opening projects (either filesystem) in editors

**Solution:**
```rust
#[cfg(target_os = "windows")]
fn detect_wsl_editors() -> Vec<EditorInfo> {
    // Check if WSL is installed
    let wsl_check = Command::new("wsl")
        .args(["--list", "--quiet"])
        .output();

    if wsl_check.is_ok() {
        // Query editors inside WSL
        let output = Command::new("wsl")
            .args(["which", "code", "cursor", "nvim"])
            .output();
        // Parse and add WSL editors with special prefix
    }
}
```

### 3.3 Opening Projects in Mixed Environment
**Difficulty: Complex**

**Challenge:** Need to:
1. Detect if project is in WSL or Windows filesystem
2. Convert paths appropriately for the target editor
3. Handle VS Code Remote-WSL extension

**Solution:**
```rust
fn open_in_editor_wsl_aware(editor: &str, project_path: &str) -> Result<(), String> {
    let is_wsl_path = project_path.starts_with("/") && !project_path.starts_with("//");
    let is_windows_editor = !editor.starts_with("wsl:");

    match (is_wsl_path, is_windows_editor) {
        (true, true) => {
            // WSL project, Windows editor (e.g., VS Code)
            // VS Code handles this automatically with Remote-WSL
            let windows_path = format!("\\\\wsl$\\Ubuntu{}", project_path);
            // Or use wslpath command
            Command::new(editor).arg(&windows_path).spawn()
        }
        (true, false) => {
            // WSL project, WSL editor
            Command::new("wsl")
                .args(["-e", &editor[4..], project_path])
                .spawn()
        }
        (false, true) => {
            // Windows project, Windows editor
            Command::new(editor).arg(project_path).spawn()
        }
        (false, false) => {
            // Windows project, WSL editor
            let wsl_path = convert_windows_to_wsl(project_path)?;
            Command::new("wsl")
                .args(["-e", &editor[4..], &wsl_path])
                .spawn()
        }
    }
}
```

### 3.4 SSH Config in WSL
**Difficulty: Complex**

**Challenge:**
- Windows SSH config: `C:\Users\{user}\.ssh\config`
- WSL SSH config: `/home/{user}/.ssh/config`
- Keys might be in either location

**Solution:**
```rust
fn get_ssh_config_paths_wsl() -> Vec<PathBuf> {
    let mut paths = vec![];

    // Windows config
    if let Some(home) = home::home_dir() {
        paths.push(home.join(".ssh").join("config"));
    }

    // WSL config (if running on Windows with WSL)
    #[cfg(target_os = "windows")]
    {
        let wsl_home = Command::new("wsl")
            .args(["bash", "-c", "echo $HOME"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok());

        if let Some(home) = wsl_home {
            // Convert to Windows path
            paths.push(PathBuf::from(format!("\\\\wsl$\\Ubuntu{}/.ssh/config", home.trim())));
        }
    }

    paths
}
```

### 3.5 Git Operations in WSL
**Difficulty: Medium**

**Challenge:** Git might be installed in Windows, WSL, or both.

**Solution:**
```rust
fn run_git_command(project_path: &str, args: &[&str]) -> Result<Output, String> {
    let is_wsl_path = project_path.starts_with("/") ||
                       project_path.starts_with("\\\\wsl$");

    if is_wsl_path {
        // Use WSL git
        let wsl_path = convert_to_wsl_native(project_path);
        Command::new("wsl")
            .args(["-e", "git"])
            .args(args)
            .current_dir(&wsl_path)
            .output()
    } else {
        // Use Windows git
        Command::new("git")
            .args(args)
            .current_dir(project_path)
            .output()
    }
}
```

### WSL Implementation Plan

| Task | Priority | Effort |
|------|----------|--------|
| Detect WSL installation and distros | High | 2-3 hours |
| Implement path conversion utilities | High | 4-6 hours |
| WSL-aware editor detection | High | 4-6 hours |
| WSL-aware editor launching | High | 4-6 hours |
| WSL-aware git operations | Medium | 3-4 hours |
| Dual SSH config support | Medium | 4-6 hours |
| UI to choose Windows vs WSL context | Medium | 3-4 hours |
| Testing across scenarios | High | 4-6 hours |

**Total Estimated Effort: 5-7 days**

---

## 4. EASY WINS (Quick Implementation)

These items can be implemented quickly and provide immediate cross-platform benefit:

### 4.1 Linux Editor Detection
```rust
// Add after line 77 in editors.rs
#[cfg(target_os = "linux")]
{
    // The which() check already works for Linux
    // Just add common alternative command names
    let linux_aliases = [
        ("code", "Visual Studio Code"),
        ("code-insiders", "VS Code Insiders"),
        ("codium", "VSCodium"),
    ];
}
```

### 4.2 Platform-Aware Keyboard Shortcut Display
Already partially done in `Titlebar.tsx`. Extend to other components:
```typescript
const modKey = navigator.platform.includes("Mac") ? "⌘" : "Ctrl";
```

### 4.3 Windows Editor Launching
```rust
#[cfg(target_os = "windows")]
{
    // Use 'cmd /c start' as fallback
    Command::new("cmd")
        .args(["/C", "start", "", &editor_command, &project_path])
        .spawn()
}
```

### 4.4 Optional Vibrancy Skip
Already handled - the `#[cfg(target_os = "macos")]` block is self-contained.

---

## 5. DEPENDENCIES TO ADD

### For Windows Support:
```toml
# Cargo.toml
[target.'cfg(windows)'.dependencies]
winreg = "0.52"           # Windows registry access
windows-acl = "0.3"       # ACL/permission management (optional)
```

### For WSL Detection:
No additional dependencies needed - can use `Command::new("wsl")`.

---

## 6. RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Linux Support (1-2 days)
1. SSH permissions (already works)
2. File paths (already works)
3. Add Linux editor detection paths
4. Test system tray on major DEs
5. Test and release Linux build

### Phase 2: Windows Basic Support (3-4 days)
1. Add Windows editor detection (registry + paths)
2. Add Windows editor launching fallback
3. Implement Windows SSH permission handling
4. Normalize path handling throughout codebase
5. Test and release Windows build

### Phase 3: Windows + WSL Support (5-7 days)
1. Add WSL detection
2. Implement path conversion utilities
3. Add WSL-aware editor detection
4. Add WSL-aware editor/git operations
5. Add UI for choosing context
6. Comprehensive testing

---

## 7. FILES REQUIRING CHANGES

| File | Linux Changes | Windows Changes | WSL Changes |
|------|--------------|-----------------|-------------|
| `src-tauri/src/commands/editors.rs` | Add detection paths | Add registry + path detection | Add WSL editor detection |
| `src-tauri/src/commands/editors.rs` | - | Add `cmd /C start` fallback | Add WSL-aware launching |
| `src-tauri/src/services/ssh_config.rs` | - | Add icacls permissions | Add dual config support |
| `src-tauri/src/services/git_config.rs` | - | Path separator handling | - |
| `src-tauri/src/commands/git.rs` | - | - | Add WSL-aware git |
| `src-tauri/src/lib.rs` | Test system tray | Test system tray | - |
| `src-tauri/Cargo.toml` | - | Add `winreg` dependency | - |
| `src/components/layout/Titlebar.tsx` | - | Already handled | - |

---

## 8. TESTING CHECKLIST

### Linux
- [ ] Editor detection (native, Flatpak, Snap)
- [ ] Editor launching
- [ ] SSH config creation and permissions
- [ ] Git operations
- [ ] System tray (GNOME, KDE, XFCE)
- [ ] Global shortcut
- [ ] Database path (XDG)

### Windows
- [ ] Editor detection (registry, PATH, common paths)
- [ ] Editor launching (direct + fallback)
- [ ] SSH config creation and permissions
- [ ] Git operations
- [ ] System tray
- [ ] Global shortcut
- [ ] Path handling (backslashes)
- [ ] Titlebar overlay

### Windows + WSL
- [ ] WSL detection
- [ ] Path conversion (both directions)
- [ ] WSL project in Windows editor
- [ ] Windows project in WSL editor
- [ ] Git operations on WSL filesystem
- [ ] SSH config from both locations

---

## 9. QUESTIONS TO CONSIDER

1. **Priority:** Which platform should be tackled first?
2. **WSL Scope:** Support WSL1, WSL2, or both? Default distro only or allow selection?
3. **Editor Discovery:** Registry scanning vs PATH-only vs manual configuration?
4. **SSH on Windows:** Native OpenSSH only, or also PuTTY/Pageant?
5. **Build/Distribution:** Linux (AppImage/Flatpak/Snap/deb/rpm)? Windows (MSI/MSIX/portable)?
