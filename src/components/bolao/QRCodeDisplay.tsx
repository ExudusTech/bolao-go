import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode, Download } from "lucide-react";

interface QRCodeDisplayProps {
  url: string;
  size?: "sm" | "md" | "lg";
  showButton?: boolean;
  buttonVariant?: "outline" | "ghost" | "default";
}

const sizes = {
  sm: 80,
  md: 120,
  lg: 200,
};

export function QRCodeDisplay({ 
  url, 
  size = "md", 
  showButton = true,
  buttonVariant = "outline" 
}: QRCodeDisplayProps) {
  const [open, setOpen] = useState(false);
  const qrSize = sizes[size];

  const handleDownload = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 300, 300);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = "qrcode-bolao.png";
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (showButton) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={buttonVariant} size="sm" className="hover-scale">
            <QrCode className="h-3.5 w-3.5 mr-1.5" />
            QR Code
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code do Bolão</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-white rounded-lg">
              <QRCodeSVG 
                id="qr-code-svg"
                value={url} 
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all px-4">
              {url}
            </p>
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Baixar QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="p-3 bg-white rounded-lg">
        <QRCodeSVG 
          value={url} 
          size={qrSize}
          level="H"
          includeMargin={false}
        />
      </div>
    </div>
  );
}
