"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="py-20 flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border shadow-lg">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-900 flex items-center justify-center">
            <Calendar className="h-10 w-10 text-white" />
          </div>

          {/* Error Code */}
          <div className="mb-4">
            <span className="text-6xl font-bold text-foreground">404</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-foreground mb-3">
            Event nicht gefunden
          </h1>

          {/* Description */}
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Die gesuchte Seite oder das Event existiert nicht. 
            Möglicherweise wurde es verschoben oder entfernt.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push("/")}
              className="flex items-center justify-center gap-2 bg-blue-900 text-white hover:text-black"
              size="lg"
            >
              <Home className="h-4 w-4" />
              Zur Startseite
            </Button>
            
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="flex items-center justify-center gap-2"
              size="lg"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück gehen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}