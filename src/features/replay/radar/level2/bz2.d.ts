/** SheetJS's bzip2 decoder, which ships without types. */
declare module "bz2" {
  export function decompress(data: Uint8Array, checkCRC?: boolean): Uint8Array;
}
