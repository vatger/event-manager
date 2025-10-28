'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { firApi } from '@/lib/api/fir';

const createFIRSchema = z.object({
  code: z.string().min(2).max(4).toUpperCase(),
  name: z.string().min(1, 'Name ist erforderlich'),
});

type CreateFIRForm = z.infer<typeof createFIRSchema>;

interface CreateFIRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateFIRDialog({ open, onOpenChange, onSuccess }: CreateFIRDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateFIRForm>({
    resolver: zodResolver(createFIRSchema),
    defaultValues: {
      code: '',
      name: '',
    },
  });

  const onSubmit = async (data: CreateFIRForm) => {
    setLoading(true);
    try {
      await firApi.createFIR({
        code: data.code.toUpperCase(),
        name: data.name,
      });
      onSuccess();
      form.reset();
    } catch (error) {
      console.error('Failed to create FIR:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue FIR erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue FIR mit Standardgruppen und Berechtigungen.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FIR Code</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="EDMM" 
                      {...field} 
                      className="uppercase"
                      maxLength={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FIR Name</FormLabel>
                  <FormControl>
                    <Input placeholder="FIR München" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Wird erstellt...' : 'FIR erstellen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}