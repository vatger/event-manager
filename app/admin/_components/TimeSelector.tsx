import { useState, useEffect, useCallback } from 'react';
import { format, addMinutes, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventTimeSelectorProps {
  onTimeChange: (startTime: Date, endTime: Date) => void;
  initialStartTime?: Date;
  initialEndTime?: Date;
}

const EventTimeSelector = ({ 
  onTimeChange,
  initialStartTime,
  initialEndTime 
}: EventTimeSelectorProps) => {
  // State für die Eingabewerte
  const [date, setDate] = useState<Date>(initialStartTime || new Date());
  const [time, setTime] = useState<string>(format(initialStartTime || new Date(), 'HH:mm'));
  const [duration, setDuration] = useState<number>(60);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Initialisierung nur einmal beim Mount oder wenn sich die Prefills ändern
  useEffect(() => {
    if (initialStartTime && initialEndTime) {
      setDate(initialStartTime);
      setTime(format(initialStartTime, 'HH:mm'));
      const calculatedDuration = differenceInMinutes(initialEndTime, initialStartTime);
      setDuration(calculatedDuration);
    }
  }, [initialStartTime, initialEndTime]);

  // Berechne die aktuellen Zeiten
  const getCurrentTimes = useCallback(() => {
    const startTimeDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    startTimeDate.setHours(hours, minutes, 0, 0);
    const endTimeDate = addMinutes(startTimeDate, duration);
    return { startTime: startTimeDate, endTime: endTimeDate };
  }, [date, time, duration]);

  // Benachrichtige Parent nur wenn sich Werte ändern
  useEffect(() => {
    const { startTime, endTime } = getCurrentTimes();
    onTimeChange(startTime, endTime);
  }, [getCurrentTimes, onTimeChange]);

  // Handler für direkte Änderungen
  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate);
      setIsCalendarOpen(false);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
  };

  const { startTime, endTime } = getCurrentTimes();

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      {/* Datum Auswahl */}
      <div className="space-y-2">
        <Label htmlFor="date">Datum</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'dd.MM.yyyy', { locale: de }) : "Datum wählen"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Zeit und Dauer */}
      <div className="grid grid-cols-2 gap-4">
        {/* Startzeit */}
        <div className="space-y-2">
          <Label htmlFor="time">Startzeit (lcl)</Label>
          <div className="relative">
            <Input
              type='time'
              id='time-picker'
              step="30"
              value={time}
              onChange={(e) => handleTimeChange((e.target.value))}
              />
          </div>
        </div>

        {/* Dauer */}
        <div className="space-y-2">
          <Label htmlFor="duration">Dauer (Minuten)</Label>
          
          <Input
            id="duration"
            type="number"
            min="15"
            max="480"
            step="15"
            value={duration}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            placeholder="60"
          />
        </div>
      </div>

      {/* Schnelle Dauer-Buttons */}
      <div className="flex flex-wrap gap-2">
        {[60, 120, 180, 300, 720].map((mins) => (
          <Button
            key={mins}
            type="button"
            variant={duration === mins ? "default" : "outline"}
            size="sm"
            onClick={() => handleDurationChange(mins)}
            className="text-xs"
          >
            {mins}min
          </Button>
        ))}
      </div>

      {/* Preview */}
      <div className="pt-4 border-t">
        <Label className="text-sm font-medium">Zeitübersicht</Label>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Beginn:</span>
            <span className="font-medium">
              {format(startTime, 'dd.MM.yyyy HH:mm', { locale: de })} lcl
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Ende:</span>
            <span className="font-medium">
              {format(endTime, 'dd.MM.yyyy HH:mm', { locale: de })} lcl
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t">
            <span className="text-gray-600">Dauer:</span>
            <span className="font-medium text-blue-600">
              {duration >= 60 
                ? `${Math.floor(duration / 60)}h ${duration % 60 > 0 ? `${duration % 60}m` : ''}`.trim()
                : `${duration}m`
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventTimeSelector;