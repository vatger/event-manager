"use client";

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import EventTimeSelector from '../admin/_components/TimeSelector';

const EventCreatePage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: null as Date | null,
    endTime: null as Date | null
  });

  // Stabile Callback-Funktion
  const handleTimeChange = useCallback((startTime: Date, endTime: Date) => {
    setFormData(prev => ({
      ...prev,
      startTime,
      endTime
    }));
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startTime || !formData.endTime) {
      alert('Bitte wähle eine gültige Zeit aus');
      return;
    }

    console.log('Event-Daten:', {
      title: formData.title,
      description: formData.description,
      startTime: formData.startTime.toISOString(),
      endTime: formData.endTime.toISOString()
    });

    // Hier DB-Speicherung implementieren
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Neues Event erstellen</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Event-Titel</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Titel eingeben"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Beschreibung</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Beschreibung eingeben"
            className="min-h-[100px]"
          />
        </div>

        <EventTimeSelector onTimeChange={handleTimeChange} />

        <Button type="submit" className="w-full">
          Event erstellen
        </Button>
      </form>
    </div>
  );
};

export default EventCreatePage;