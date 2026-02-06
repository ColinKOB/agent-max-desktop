#!/usr/bin/env python3
"""
Extract app icon from a macOS app bundle.
Uses NSWorkspace which works reliably for all apps including system apps
with icons stored in Assets.car.

Usage: python3 extract-icon.py /path/to/App.app /path/to/output.png [size]
"""

import sys
import os

def extract_icon(app_path, output_path, size=64):
    try:
        from AppKit import NSWorkspace, NSBitmapImageRep, NSBitmapImageFileTypePNG

        workspace = NSWorkspace.sharedWorkspace()
        icon = workspace.iconForFile_(app_path)

        if not icon:
            return False

        # Resize to requested size
        icon.setSize_((size, size))
        tiff_data = icon.TIFFRepresentation()
        bitmap_rep = NSBitmapImageRep.imageRepWithData_(tiff_data)
        png_data = bitmap_rep.representationUsingType_properties_(NSBitmapImageFileTypePNG, None)

        with open(output_path, 'wb') as f:
            f.write(png_data)

        return True
    except ImportError:
        # PyObjC not available, return False to signal fallback needed
        return False
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: extract-icon.py <app_path> <output_path> [size]", file=sys.stderr)
        sys.exit(1)

    app_path = sys.argv[1]
    output_path = sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 64

    if extract_icon(app_path, output_path, size):
        print("OK")
        sys.exit(0)
    else:
        sys.exit(1)
