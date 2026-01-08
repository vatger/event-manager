import axios from "axios";
import {
  IVatsimEvent,
  IVatsimEventResponse,
  IAtcBooking,
} from "./vatsim.types";

class VatsimService {
  async getEvents(): Promise<IVatsimEvent[]> {
    const res = await axios.get<IVatsimEventResponse>(
      "https://my.vatsim.net/api/v2/events/latest"
    );
    return res.data.data;
  }

  async getBookings(): Promise<IAtcBooking[]> {
    const res = await axios.get<IAtcBooking[]>(
      "https://atc-bookings.vatsim.net/api/booking"
    );
    return res.data;
  }
}

export const vatsimService = new VatsimService();
