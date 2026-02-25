import { EventEmitter } from 'events';
import type { Server as SocketServer } from 'socket.io';

export interface LivePunchEventPayload {
  organizationId: string;
  employeeId: string;
  employeeName: string;
  punchType: 'IN' | 'OUT';
  punchTime: string;
  validationStatus: 'valid' | 'invalid' | 'pending_approval' | 'warning';
  colorHex: string;
  location: {
    latitude: number;
    longitude: number;
    distanceMeters: number | null;
  };
}

export interface OccupancyEventPayload {
  organizationId: string;
  currentOccupancy: number;
  checkedInEmployees: number;
  checkedOutEmployees: number;
  generatedAt: string;
}

const emitter = new EventEmitter();
let io: SocketServer | null = null;

const orgRoom = (organizationId: string): string => `org:${organizationId}`;

export const setAttendanceSocketServer = (socketServer: SocketServer): void => {
  io = socketServer;
};

export const registerAttendanceRealtimeHooks = (): void => {
  emitter.on('live_punch', (payload: LivePunchEventPayload) => {
    if (io) {
      io.to(orgRoom(payload.organizationId)).emit('attendance:live-punch', payload);

      if (payload.validationStatus === 'invalid' || payload.validationStatus === 'pending_approval') {
        io.to(orgRoom(payload.organizationId)).emit('attendance:invalid-alert', payload);
      }
    }
  });

  emitter.on('occupancy', (payload: OccupancyEventPayload) => {
    if (io) {
      io.to(orgRoom(payload.organizationId)).emit('attendance:occupancy', payload);
    }
  });
};

export const emitLivePunchEvent = (payload: LivePunchEventPayload): void => {
  emitter.emit('live_punch', payload);
};

export const emitOccupancyEvent = (payload: OccupancyEventPayload): void => {
  emitter.emit('occupancy', payload);
};

export const getAttendanceRoomName = (organizationId: string): string => orgRoom(organizationId);
