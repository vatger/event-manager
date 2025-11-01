"use client";
import AdminEventForm from "@/app/admin/events/_components/AdminEventForm";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import axios from "axios";
import { Event } from "@/types";

export default function EditEventPage() {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const baseUrl = window.location.origin;
  const { id } = useParams() as { id?: string | string[] };
  const eventId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await axios.get(`${baseUrl}/api/events/${eventId}`);
        if (response.status === 200) {
          setEvent(response.data);
        } else {
          router.push("/404");
        }
      } catch (error) {
        router.push("/404");
      } finally {
        setLoading(false);
      }
    };

    if (!eventId) {
      return;
    }

    fetchEvent();
  }, [eventId, router, baseUrl]);

  if (loading) return <p>Loading...</p>;
  if (!event) return null;

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <AdminEventForm
        event={event}
      />
    </div>
  );
}
