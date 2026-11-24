declare module "qrcode" {
  export function toString(
    text: string,
    options: { type: "svg"; margin?: number; width?: number },
  ): Promise<string>;
}
