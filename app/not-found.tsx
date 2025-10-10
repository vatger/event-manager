// components/404/NotFound.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
            <Calendar className="h-10 w-10 text-blue-900" />
          </div>

          {/* Error Code */}
          <div className="mb-4">
            <span className="text-6xl font-bold text-slate-900">404</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">
            Event nicht gefunden
          </h1>

          {/* Description */}
          <p className="text-slate-600 mb-8 leading-relaxed">
            Die gesuchte Seite oder das Event existiert nicht. 
            Möglicherweise wurde es verschoben oder entfernt.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push("/")}
              className="bg-blue-900 hover:bg-blue-950 text-white flex items-center justify-center gap-2"
              size="lg"
            >
              <Home className="h-4 w-4" />
              Zur Startseite
            </Button>
            
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
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