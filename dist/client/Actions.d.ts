import type { FlightClient } from './FlightClient';
import { FlightDescriptor } from '../generated/Flight';
export declare function listFlights(client: FlightClient): Promise<any[]>;
export declare function getFlightInfo(client: FlightClient, descriptor: FlightDescriptor): Promise<any>;
