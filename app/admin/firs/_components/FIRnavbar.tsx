'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CurrentUser } from '@/types/fir';
import { firApi } from '@/lib/api/fir';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { User, Settings, LogOut, Home, Users } from 'lucide-react';

export function FIRNavbar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    firApi.getCurrentUser().then(setCurrentUser).catch(console.error);
  }, []);

  const isFIRsPage = pathname === '/admin/firs';
  const isFIRDetailPage = pathname.startsWith('/admin/firs/') && pathname !== '/admin/firs';

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin/firs" className="font-bold text-xl flex items-center gap-2">
              <Users className="w-5 h-5" />
              FIR Management
            </Link>
            
            <div className="flex items-center gap-4">
              <Link href="/admin/firs">
                <Button
                  variant={isFIRsPage ? 'secondary' : 'ghost'}
                  size="sm"
                >
                  FIR Übersicht
                </Button>
              </Link>
              
              {isFIRDetailPage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>/</span>
                  <span>Aktive FIR</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Zur Hauptseite
              </Button>
            </Link>

            {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{currentUser.name}</span>
                    <Badge variant="secondary">{currentUser.effectiveLevel.level}</Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{currentUser.name}</span>
                      <span className="text-xs text-muted-foreground">
                        CID: {currentUser.cid}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Rating: {currentUser.rating}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Einstellungen
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <LogOut className="w-4 h-4 mr-2" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}