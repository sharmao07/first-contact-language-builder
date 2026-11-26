import Image from "next/image";

export function EvidenceImage({ src, alt }: { src: string; alt: string }) {
  return <Image className="thumb" src={src} alt={alt} width={560} height={320} unoptimized />;
}

export function PreviewFrame({ src, alt }: { src: string; alt: string }) {
  return <div className="thumb preview-frame" role="img" aria-label={alt} style={{ backgroundImage: `url(${JSON.stringify(src)})` }} />;
}
