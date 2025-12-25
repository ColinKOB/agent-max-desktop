{
  "targets": [
    {
      "target_name": "virtual_display",
      "sources": [
        "addon.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "12.0",
        "OTHER_CPLUSPLUSFLAGS": [
          "-std=c++17",
          "-stdlib=libc++"
        ],
        "OTHER_LDFLAGS": [
          "-framework CoreGraphics",
          "-framework ScreenCaptureKit",
          "-framework AppKit",
          "-framework CoreVideo",
          "-framework Foundation",
          "-L<(module_root_dir)/.build/release",
          "-lVirtualDisplay",
          "-Wl,-rpath,@loader_path"
        ]
      },
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='mac'", {
          "sources": ["addon.mm"]
        }]
      ]
    }
  ]
}
