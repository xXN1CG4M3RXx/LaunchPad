import os
import subprocess
import sys

def main():
    source_icon = "app-icon.png"
    if not os.path.exists(source_icon):
        print(f"Error: Source icon '{source_icon}' not found in the project root.")
        sys.exit(1)

    print(f"Generating icons from '{source_icon}' using Tauri CLI...")
    try:
        # Run npx tauri icon to regenerate the icons
        result = subprocess.run(
            ["npx", "tauri", "icon", source_icon],
            check=True,
            capture_output=True,
            text=True,
            shell=True
        )
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print("Error: Failed to generate icons using Tauri CLI.")
        print(e.stderr)
        sys.exit(1)

    # Validate that the main icons exist
    expected_icons = [
        "src-tauri/icons/32x32.png",
        "src-tauri/icons/128x128.png",
        "src-tauri/icons/128x128@2x.png",
        "src-tauri/icons/icon.icns",
        "src-tauri/icons/icon.ico",
        "src-tauri/icons/icon.png",
    ]

    missing = []
    for icon_path in expected_icons:
        if not os.path.exists(icon_path):
            missing.append(icon_path)

    if missing:
        print("\nWarning: The following expected icons are missing:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)
    else:
        print("\nSuccess: All icons successfully generated and validated!")

if __name__ == "__main__":
    main()
