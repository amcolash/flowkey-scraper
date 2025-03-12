#!/bin/bash

# Input files
ORIGINAL="images/debug/region.png"
NEW="images/debug/template.png"
DIFF="images/debug/diff.png"
OUTPUT="images/debug/comparison.png"

# Function to generate comparison image
generate_diff() {
  echo "Generating diff..."
  compare "$ORIGINAL" "$NEW" "$DIFF"

  # Add 1px black border to each image
  convert "$ORIGINAL" -bordercolor black -border 1 "$ORIGINAL"_bordered.png
  convert "$NEW" -bordercolor black -border 1 "$NEW"_bordered.png
  convert "$DIFF" -bordercolor black -border 1 "$DIFF"_bordered.png

  # Create side-by-side comparison (original | new | diff)
  convert +append "$ORIGINAL"_bordered.png "$NEW"_bordered.png "$DIFF"_bordered.png "$OUTPUT"

  # Scale the final output to 2x
  convert "$OUTPUT" -resize 200% "$OUTPUT"

  echo "Updated: $OUTPUT"
}

# Initial diff generation
generate_diff

# Watch for file changes and regenerate
inotifywait -m -e close_write "$ORIGINAL" "$NEW" | while read -r filename event; do
  echo "Detected change in $filename"
  generate_diff
done
