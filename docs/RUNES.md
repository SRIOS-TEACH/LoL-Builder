# Rune stacks and game time

The toolbar's Game time field takes elapsed minutes, including decimals. It updates time-dependent rune stats such as Gathering Storm and Conditioning. It does not advance combat simulation or replace a buff's separate elapsed-duration control.

The **Stacks** button beside Selected runes opens counters for the selected stacking runes. Inputs are nonnegative integers, capped where applicable. Counters persist when switching rune choices, but only currently selected runes contribute to stats.

Manaflow affects maximum mana; Ultimate Hunter affects ultimate haste; Legend runes affect attack speed, basic haste or lifesteal/health. Conqueror, Lethal Tempo, Grasp's permanent health, Overgrowth, Biscuits and Jack of All Trades have stat bindings. Coefficients are read from explicit clauses in the selected Data Dragon patch's descriptions. Missing/changed descriptions do not fall back to guessed balance coefficients. Adaptive bonuses follow the builder's existing adaptive-stat choice.

Some counters describe economy, vision or triggered combat effects outside the current stat model. Their modal notes explicitly say when the count is retained but its effect is not included in totals. This includes Dark Harvest damage, Fleet healing, hunter economy/movement effects and vision stacks. Grasp damage/healing and Lethal Tempo's maximum-stack bonus damage are also outside these rune stat bindings.

Rune descriptions use a fixed-position overlay attached to the page body, outside the scrolling rune panel. Hover and keyboard focus display it; Escape, scrolling or a resize dismisses it. The stack dialog returns focus to its button when closed and supports Escape and Tab navigation.

Validation: `tests/rune-effects.test.cjs` uses captured rune descriptions; `tests/dashboard-browser.cjs` checks real stack/time input, clamps, haste propagation, tooltip placement, desktop and mobile layout. Tests use patch 16.18.1 fixtures, not in-game simulation.
