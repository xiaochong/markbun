#!/bin/bash

SOURCE_SVG="../docs/assets/logo.svg"        # 你的 SVG 文件
ICONSET_NAME="AppIcon.iconset"
OUTPUT_ICNS="AppIcon.icns"

# 1. 创建 iconset 文件夹
mkdir -p "$ICONSET_NAME"

# 2. 定义所有需要的尺寸（macOS 共需10个文件）
declare -a SIZES=(
    "16:16"      # icon_16x16.png
    "16:32"      # icon_16x16@2x.png (实际尺寸32x32)
    "32:32"      # icon_32x32.png
    "32:64"      # icon_32x32@2x.png
    "128:128"    # icon_128x128.png
    "128:256"    # icon_128x128@2x.png
    "256:256"    # icon_256x256.png
    "256:512"    # icon_256x256@2x.png
    "512:512"    # icon_512x512.png
    "512:1024"   # icon_512x512@2x.png (Retina)
)

# 3. 生成各尺寸 PNG（使用 rsvg-convert）
for PAIR in "${SIZES[@]}"; do
    LABEL="${PAIR%%:*}"
    PIXEL="${PAIR##*:}"

    # 计算文件名（判断是否为 @2x）
    if [ "$LABEL" = "$PIXEL" ]; then
        FILENAME="icon_${LABEL}x${LABEL}.png"
    else
        FILENAME="icon_${LABEL}x${LABEL}@2x.png"
    fi

    # SVG → PNG
    rsvg-convert -w "$PIXEL" -h "$PIXEL" "$SOURCE_SVG" -o "$ICONSET_NAME/$FILENAME"
    echo "生成: $FILENAME (${PIXEL}x${PIXEL})"
done

# 4. 转换为 icns 格式
iconutil -c icns "$ICONSET_NAME" -o "$OUTPUT_ICNS"
echo "完成: $OUTPUT_ICNS"

# 5. 清理（可选）
# rm -rf "$ICONSET_NAME"