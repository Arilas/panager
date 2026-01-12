# Cross-Platform Support Plan

## Panager - Project Manager for Developers

**Current State:** macOS-focused with Linux support in progress
**Target Platforms:** Linux (GTK/GNOME), Windows (native), Windows with WSL
**Last Updated:** January 2026

---

## Architecture Overview

The codebase has been refactored to support clean platform separation:

```
src-tauri/src/
├── platform/
│   ├── mod.rs           # Platform module router
│   ├── macos/           # macOS-specific code
│   │   ├── mod.rs
│   │   ├── menu.rs      # Native menu bar
│   │   ├── tray.rs      # System tray + global shortcuts
│   │   └── vibrancy.rs  # Window vibrancy + Liquid Glass
│   └── linux/           # Linux-specific code [NEW]
│       ├── mod.rs
│       └── tray.rs      # System tray + global shortcuts
├── commands/
│   └── editors.rs       # Editor detection (platform-aware)
├── ssh/
│   └── config.rs        # SSH config (uses #[cfg(unix)])
└── ...
```

---

## Platform Compatibility Matrix

| Feature | macOS | Linux | Windows | Windows+WSL |
|---------|-------|-------|---------|-------------|
| System Tray | ✅ | ✅ | ⏳ Planned | ⏳ Planned |
| Global Shortcut | ✅ | ✅ | ⏳ Planned | ⏳ Planned |
| Native Menu Bar | ✅ | N/A | ⏳ Planned | ⏳ Planned |
| Window Vibrancy | ✅ | N/A | N/A | N/A |
| Liquid Glass | ✅ | N/A | N/A | N/A |
| Editor Detection | ✅ | ✅ | ⏳ Planned | ⏳ Planned |
| SSH Config | ✅ | ✅ | ⏳ Planned | ⏳ Planned |
| Git Operations | ✅ | ✅ | ✅ | ⏳ Planned |

---

## 1. LINUX SUPPORT (GTK/GNOME) [IN PROGRESS]

### Implemented Features

#### 1.1 Platform Module (`platform/linux/`)
- **tray.rs**: System tray with context menu (Show/Quit)
- **tray.rs**: Global shortcut (Ctrl+Shift+O)
- Left-click tray icon shows main window
- Works with GTK-based desktop environments

#### 1.2 Editor Detection (`commands/editors.rs`)
Detects editors installed via:
- **Native packages** (via PATH using `which`)
- **Flatpak** apps with `flatpak info` check
- **Snap** apps in `/snap/bin/`
- **JetBrains Toolbox** in `~/.local/share/JetBrains/Toolbox/scripts/`
- **AppImage** files in `~/Applications/`, `~/.local/bin/`, `~/AppImages/`

Supported editors:
| Editor | Native | Flatpak | Snap | Toolbox | AppImage |
|--------|--------|---------|------|---------|----------|
| VS Code | ✅ | ✅ | ✅ | - | ✅ |
| VSCodium | ✅ | ✅ | ✅ | - | - |
| Cursor | ✅ | - | - | - | ✅ |
| Zed | ✅ | ✅ | - | - | ✅ |
| Sublime Text | ✅ | ✅ | ✅ | - | - |
| Neovim | ✅ | ✅ | ✅ | - | ✅ |
| IntelliJ IDEA | ✅ | ✅ | ✅ | ✅ | - |
| WebStorm | ✅ | ✅ | ✅ | ✅ | - |
| PyCharm | ✅ | ✅ | ✅ | ✅ | - |
| GoLand | ✅ | ✅ | ✅ | ✅ | - |
| CLion | ✅ | ✅ | ✅ | ✅ | - |
| PhpStorm | ✅ | ✅ | ✅ | ✅ | - |
| RubyMine | ✅ | ✅ | ✅ | ✅ | - |
| Rider | ✅ | - | ✅ | ✅ | - |
| DataGrip | ✅ | - | ✅ | ✅ | - |
| Fleet | ✅ | - | - | ✅ | - |

#### 1.3 Editor Launching
- Direct command execution for native/Snap/Toolbox/AppImage
- Special handling for Flatpak: `flatpak run <app-id> <path>`
- Helpful error messages guiding users to install editors

#### 1.4 SSH Config (Already Works)
The `#[cfg(unix)]` blocks in `ssh/config.rs` handle:
- SSH directory creation with `0o700` permissions
- SSH key files with `0o644` permissions
- SSH config file with `0o600` permissions

#### 1.5 File Paths (Already Works)
The `directories` crate provides correct XDG paths:
- Config: `~/.config/panager/`
- Data: `~/.local/share/panager/`
- Cache: `~/.cache/panager/`

### Remaining Linux Tasks

| Task | Priority | Status |
|------|----------|--------|
| Test on GNOME Shell | High | Pending |
| Test on KDE Plasma | Medium | Pending |
| Test on Xfce | Medium | Pending |
| Test AppIndicator extension requirement | High | Pending |
| Test Wayland vs X11 compatibility | Medium | Pending |

### Known Linux Considerations

1. **GNOME Shell** requires the "AppIndicator and KStatusNotifierItem Support" extension for tray icons
2. **Wayland** may have different global shortcut behavior
3. **Flatpak sandboxing** may require additional portal permissions

---

## 2. WINDOWS SUPPORT (Native) [PLANNED]

### Status: **Not Started**

### Required Changes

#### 2.1 Platform Module (`platform/windows/`)
```rust
// platform/windows/mod.rs
pub mod tray;

// platform/windows/tray.rs
// Same as Linux - Tauri's API is cross-platform
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> { ... }
pub fn setup_global_shortcut(app: &App) -> Result<(), Box<dyn std::error::Error>> { ... }
```

#### 2.2 Editor Detection
Need to add Windows-specific paths:
```rust
#[cfg(target_os = "windows")]
{
    // Check common installation paths
    let windows_paths = [
        (r"C:\Users\{user}\AppData\Local\Programs\Microsoft VS Code\code.exe", "VS Code", "code"),
        (r"C:\Program Files\Microsoft VS Code\code.exe", "VS Code", "code"),
        (r"C:\Users\{user}\AppData\Local\Programs\cursor\cursor.exe", "Cursor", "cursor"),
        // ... more paths
    ];

    // Check Windows Registry for installed apps
    // HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths
}
```

#### 2.3 SSH Config Permissions
Need Windows-specific permission handling:
```rust
#[cfg(windows)]
{
    // Use icacls or windows-acl crate
    Command::new("icacls")
        .args([&ssh_dir, "/inheritance:r", "/grant:r", &format!("{}:F", username)])
        .output();
}
```

#### 2.4 Dependencies
```toml
[target.'cfg(windows)'.dependencies]
winreg = "0.52"           # Windows registry access
```

### Windows Implementation Plan

| Task | Priority | Effort |
|------|----------|--------|
| Create platform/windows module | High | 1 hour |
| Add Windows editor detection | High | 4-6 hours |
| Add Windows SSH permissions | High | 3-4 hours |
| Test titlebar overlay | Medium | 1-2 hours |
| Create Windows installer | Medium | 2-4 hours |

**Total Estimated Effort: 2-3 days**

---

## 3. WINDOWS + WSL SUPPORT [PLANNED]

### Status: **Not Started**

This is the most complex scenario due to dual filesystems.

### Key Challenges

1. **Path Conversion**
   - WSL: `/home/user/projects/` ↔ Windows: `\\wsl$\Ubuntu\home\user\projects\`
   - Windows: `C:\Users\user\` ↔ WSL: `/mnt/c/Users/user/`

2. **Dual Editor Detection**
   - Windows editors (VS Code, etc.)
   - WSL editors (nvim, vim in distro)

3. **Git Operations**
   - Use Windows git for Windows paths
   - Use WSL git for WSL paths

4. **SSH Config**
   - Windows: `C:\Users\{user}\.ssh\config`
   - WSL: `/home/{user}/.ssh/config`

### Implementation Plan

| Task | Priority | Effort |
|------|----------|--------|
| Detect WSL installation | High | 2-3 hours |
| Path conversion utilities | High | 4-6 hours |
| WSL-aware editor detection | High | 4-6 hours |
| WSL-aware git operations | Medium | 3-4 hours |
| Dual SSH config support | Medium | 4-6 hours |

**Total Estimated Effort: 5-7 days**

---

## 4. IMPLEMENTATION ROADMAP

### Phase 1: Linux Support (Current)
- [x] Create platform/linux module
- [x] Add system tray support
- [x] Add global shortcut support
- [x] Add Flatpak editor detection
- [x] Add Snap editor detection
- [x] Add JetBrains Toolbox detection
- [x] Add AppImage detection
- [x] Handle Flatpak editor launching
- [ ] Test on various desktop environments
- [ ] Create Linux packages (AppImage, Flatpak, deb, rpm)

### Phase 2: Windows Support
- [ ] Create platform/windows module
- [ ] Add Windows editor detection
- [ ] Add Windows SSH permissions
- [ ] Test Windows build
- [ ] Create Windows installer (MSI/MSIX)

### Phase 3: Windows + WSL Support
- [ ] Add WSL detection
- [ ] Add path conversion
- [ ] Add WSL-aware operations
- [ ] Comprehensive testing

---

## 5. TESTING CHECKLIST

### Linux
- [ ] GNOME Shell (with AppIndicator extension)
- [ ] KDE Plasma
- [ ] Xfce
- [ ] MATE
- [ ] Cinnamon
- [ ] X11 vs Wayland
- [ ] Flatpak sandboxed environment
- [ ] Snap sandboxed environment

### Windows
- [ ] Windows 10
- [ ] Windows 11
- [ ] Standard user vs Admin
- [ ] Various editor installations

### Windows + WSL
- [ ] WSL1
- [ ] WSL2
- [ ] Ubuntu distro
- [ ] Multiple distros
- [ ] Mixed filesystem operations

---

## 6. NOTES

### Desktop Environment Specifics

**GNOME Shell:**
- Requires AppIndicator extension for tray icons
- No native global menu support
- System tray may need "Tray Icons: Reloaded" extension

**KDE Plasma:**
- Native system tray support
- Consider adding blur effect (optional)
- Global shortcuts work well

**Xfce/MATE/Cinnamon:**
- Native system tray support
- Traditional desktop paradigm

### Build Requirements

**Linux:**
```bash
# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

**Windows:**
- Visual Studio Build Tools
- WebView2 Runtime (usually pre-installed on Windows 10/11)
