/**
 * The National Weather Service composite reflectivity palette, as the Iowa
 * Environmental Mesonet publishes it.
 *
 * This is not decoration. IEM's archived radar rasters are 8-bit paletted
 * PNGs whose palette *index* is the measurement: dBZ = -32 + 0.5 x index,
 * with index 0 meaning no data. The colours are how the index is transmitted.
 *
 * The palette is injective — all 256 entries are distinct — and every colour
 * in an archived tile is an exact entry, both of which I checked before
 * relying on them. So an RGB pixel maps back to its index, and therefore to
 * an exact reflectivity in half-dBZ steps, with nothing lost. That is what
 * makes it possible to throw IEM's colours away and draw the data in a
 * palette chosen for chasing instead.
 *
 * Generated from the archive; regenerate with the note in scripts/README if
 * IEM ever changes it. 768 bytes, base64, rather than 256 lines of numbers.
 */
export const N0Q_PALETTE_B64 =
  "AAAAhXGPhXKPhnONh3WLh3aLiHeJiXmHiXqHinuFi32Ei36EjH+CjYGAjYKAjoN+j4R8j4V8kId7kYh5kYl5kot3k411lpFTmJRXm5dbnZpgoJ1ko6BopaNtqKZxqql2rax6sK9+srKDt7iMuruQvb6Uv8GZwsSdxMeix8qmys2qzNCv0tS0z9K0ycy0xsm0w8e0wMS0vcG0ub60tru0s7m0sLa0rbO0qrC0pKu0oKi0naW0mqK0l6C0lJ20kZq0lJu1kJi0jJWziJKygIywfImveIaudIOscICrbH2qZ3mpY3aoX3OnW3CmV22kT2eiS2ShR2GgQ16fQVueQ2GiRWimSG+qSnauTX2yT4S2UYu7VpnDWZ/HW6bLXq3PYLTUYrvYZcLcZ8ngatDkb9boaNbXWdazUtaiS9aQQ9Z+PNZtNdZbEdUYEdEXEM0XEMgWEMQWD7wVD7cUDrMUDq8TDqsTDaYSDaISDZ4RDJkRDJUQDJEQC4gPC4QOCoAOCnwNCncNCXMMCW8MCWsLCGYLCGIKCV4JMnMIRn0IW4gHb5IHhJ0GmKgGrbIFwb0F1scE6tIE/+IA/9gA/9MA/84A/8kA/8QA/8AA/7sA/7YA/7EA/6wA/6cA/6IA/5kA/5QA/48A/4oA/4UA/4AA/wAA+AAA8QAA6gAA4wAA1QAAzQAAxgAAvwAAuAAAsQAAqgAAowAAmwAAlAAAjQAAfwAAeAAAcQAA//////X//+r//9///9T//8n//77//7P//53//5L//3X//Gv9+WD69lb380v08EDx7Tbv6ivs5yDp4QvjsgD/rAD8pAD3mwD0kwDviADqgwDoeQDicgDdaQDbBezwBevwBerwBd3gBdzgBdvgBc3QBczQBL3ABLzABLvABK6wBK2wBJ6gBJ2gBJygA46QA42QA4yQA36AA32AA29wA25wA21wAl9gAl5gAk9QAk5QAk1QAj9AAj5AAj1AATAwAS8wASAgAR8gAR4gOme1Oma1OmW1OmS1OmO1OmK1";

/** dBZ for a palette index. Index 0 is "nothing here", not -32 dBZ. */
export const dbzForIndex = (i: number): number => -32 + 0.5 * i;

/** The index a dBZ value would have. Inverse of the above, for the legend. */
export const indexForDbz = (dbz: number): number =>
  Math.max(1, Math.min(255, Math.round((dbz + 32) * 2)));
