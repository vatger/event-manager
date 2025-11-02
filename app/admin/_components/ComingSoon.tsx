'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export default function ComingSoon() {

  return (
    <div className="flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 pt-10">

        {/* Hauptinhalt */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              Kommt bald...
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-600 text-base text-center">
            Dieses Feature ist in Planung und wird demnächst hinzugefügt.
          </CardContent>
          
        </Card>
      </div>
    </div>
  )
}