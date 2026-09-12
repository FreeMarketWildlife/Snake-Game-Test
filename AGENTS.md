# Art direction

- Use pixel-art assets for all icons; do not introduce emoji or font-symbol icons.
- Author UI icons and miniature building illustrations on a 32 × 32 pixel canvas
  and display them at native size. Draw miniature versions rather than shrinking
  world sprites. Use the existing game palette and crisp nearest-neighbor rendering.
- World sprites use one art pixel per world unit; camera zoom applies uniformly.
  Preserve that shared scale. Do not independently stretch art or use fractional
  scaling for UI assets. Building portraits use their native sprite dimensions.
- Inventory/category panels should open adjacent to their toolbar trigger rather
  than as centered modal windows. Keep the world visible and usable.
