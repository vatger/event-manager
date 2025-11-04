'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, User, ArrowRight } from 'lucide-react';

export function UserSearch() {
  const [cid, setCid] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cid.trim()) return;
    
    setLoading(true);
    router.push(`/admin/qualifications/${cid.trim()}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          User Qualifications anzeigen
        </CardTitle>
        <CardDescription>
          Geben Sie eine CID ein, um die Qualifications eines Benutzers anzuzeigen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="CID eingeben (z.B. 1234567)"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            type="number"
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !cid.trim()}>
            <Search className="w-4 h-4 mr-2" />
            {loading ? 'Lädt...' : 'Anzeigen'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}